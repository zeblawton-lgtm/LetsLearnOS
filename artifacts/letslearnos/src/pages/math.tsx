import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playCorrect, playWrong, playFanfare, playTap } from "@/lib/sound";
import { playJingle } from "@/lib/music";
import { speakText, speakSequence, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenText } from "@/lib/pronounce";
import { POKEMON_POOL, getSpokenQuestion, type AnyQuestion } from "@/lib/spoken-math";
import {
  getExplanation,
  explanationWaitSeconds,
  type ExplanationResult,
} from "@/content/math-explain";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { math3YoQuestions, type Math3YoQuestion } from "@/content/math-3yo";
import { math5YoQuestions, type Math5YoQuestion } from "@/content/math-5yo";

const SPRITE = ARTWORK;
const QUESTIONS_PER_SESSION = 10;
const QUESTION_HISTORY_VERSION = "v2";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mathHistoryKey(
  profileId: string | number | undefined,
  is3yo: boolean,
) {
  return `letslearnos:math:${QUESTION_HISTORY_VERSION}:${profileId ?? "guest"}:${is3yo ? "3yo" : "5yo"}`;
}

function readQuestionHistory(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id) => typeof id === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeQuestionHistory(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Local storage is only used to avoid repeat questions; math still works without it.
  }
}

function selectSessionQuestions(
  allQuestions: AnyQuestion[],
  storageKey: string,
): AnyQuestion[] {
  const uniqueQuestions = [
    ...new Map(allQuestions.map((q) => [q.id, q])).values(),
  ];
  let usedIds = readQuestionHistory(storageKey);
  let available = uniqueQuestions.filter((q) => !usedIds.has(q.id));

  if (
    available.length < Math.min(QUESTIONS_PER_SESSION, uniqueQuestions.length)
  ) {
    usedIds = new Set();
    available = uniqueQuestions;
  }

  const selected = shuffle(available).slice(0, QUESTIONS_PER_SESSION);
  const nextUsedIds = new Set(usedIds);
  selected.forEach((q) => nextUsedIds.add(q.id));

  if (nextUsedIds.size >= uniqueQuestions.length) {
    writeQuestionHistory(storageKey, new Set(selected.map((q) => q.id)));
  } else {
    writeQuestionHistory(storageKey, nextUsedIds);
  }

  return selected;
}

function spriteClass(total: number) {
  if (total <= 5) return "w-36 h-36";
  if (total <= 10) return "w-28 h-28";
  if (total <= 15) return "w-20 h-20";
  return "w-16 h-16";
}

// Above this product, drawing one sprite per unit (up to 9 x 9 = 81 for the
// full multiplication-fact pool) is illegible at 4K/200% — it wraps into a
// dense unreadable block. Past the cap, MultiplyVisual switches to one
// sprite per GROUP (with a "x b" badge) instead of one sprite per unit.
const MULTIPLY_SPRITE_CAP = 25;

// ─── Visual components ───────────────────────────────────────────────────────

function CountVisual({
  count,
  id,
  name,
}: {
  count: number;
  id: number;
  name: string;
}) {
  const sz = spriteClass(count);
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <motion.img
          key={i}
          src={SPRITE(id)}
          onError={onSpriteError}
          alt={name}
          className={`${sz} object-contain`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: i * 0.04,
            type: "spring",
            stiffness: 320,
            damping: 18,
          }}
        />
      ))}
    </div>
  );
}

function AddVisual({
  a,
  b,
  id,
  name,
}: {
  a: number;
  b: number;
  id: number;
  name: string;
}) {
  const total = a + b;
  const sz = spriteClass(total);
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <div className="flex flex-wrap justify-center gap-1 bg-blue-50 border-2 border-blue-200 rounded-2xl p-2">
        {Array.from({ length: a }).map((_, i) => (
          <motion.img
            key={`a${i}`}
            src={SPRITE(id)}
            onError={onSpriteError}
            alt={name}
            className={`${sz} object-contain`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: i * 0.05,
              type: "spring",
              stiffness: 320,
              damping: 18,
            }}
          />
        ))}
      </div>
      <span className="text-5xl font-black text-gray-400">+</span>
      <div className="flex flex-wrap justify-center gap-1 bg-amber-50 border-2 border-amber-200 rounded-2xl p-2">
        {Array.from({ length: b }).map((_, i) => (
          <motion.img
            key={`b${i}`}
            src={SPRITE(id)}
            onError={onSpriteError}
            alt={name}
            className={`${sz} object-contain`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: (a + i) * 0.05,
              type: "spring",
              stiffness: 320,
              damping: 18,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SubtractVisual({
  a,
  b,
  id,
  name,
}: {
  a: number;
  b: number;
  id: number;
  name: string;
}) {
  const remaining = a - b;
  const sz = spriteClass(a);
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {/* Remaining sprites — bright */}
      {Array.from({ length: remaining }).map((_, i) => (
        <motion.img
          key={`r${i}`}
          src={SPRITE(id)}
          onError={onSpriteError}
          alt={name}
          className={`${sz} object-contain`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: i * 0.04,
            type: "spring",
            stiffness: 320,
            damping: 18,
          }}
        />
      ))}
      {/* Subtracted sprites — faded + X */}
      {Array.from({ length: b }).map((_, i) => (
        <motion.div
          key={`d${i}`}
          className={`${sz} relative shrink-0`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: (remaining + i) * 0.04,
            type: "spring",
            stiffness: 320,
            damping: 18,
          }}
        >
          <img
            src={SPRITE(id)}
            onError={onSpriteError}
            alt=""
            className={`${sz} object-contain opacity-20 grayscale`}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="text-red-500 font-black leading-none"
              style={{ fontSize: "clamp(14px, 3vw, 22px)" }}
            >
              ✕
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function MultiplyVisual({
  a,
  b,
  id,
  name,
}: {
  a: number;
  b: number;
  id: number;
  name: string;
}) {
  const total = a * b;

  // Large facts (up to 9 x 9 = 81) get a condensed "one sprite per group"
  // view instead of one sprite per unit — keeps it legible at 4K/200%.
  if (total > MULTIPLY_SPRITE_CAP) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-3 max-w-xl">
          {Array.from({ length: a }).map((_, i) => (
            <motion.div
              key={i}
              className="relative w-16 h-16 shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: i * 0.05,
                type: "spring",
                stiffness: 320,
                damping: 18,
              }}
            >
              <img
                src={SPRITE(id)}
                onError={onSpriteError}
                alt={name}
                className="w-16 h-16 object-contain"
              />
              <span className="absolute -bottom-1 -right-1 min-w-[28px] h-7 px-1 rounded-full bg-purple-600 text-white text-sm font-black flex items-center justify-center">
                ×{b}
              </span>
            </motion.div>
          ))}
        </div>
        <p className="text-lg text-gray-500 font-bold mt-1">
          {a} groups of {b} = {total}
        </p>
      </div>
    );
  }

  const sz = spriteClass(total);
  return (
    <div className="flex flex-col items-center gap-2">
      {Array.from({ length: a }).map((_, row) => (
        <div
          key={row}
          className="flex gap-1 bg-purple-50 border-2 border-purple-200 rounded-xl px-2 py-1"
        >
          {Array.from({ length: b }).map((_, col) => (
            <motion.img
              key={col}
              src={SPRITE(id)}
              onError={onSpriteError}
              alt={name}
              className={`${sz} object-contain`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: (row * b + col) * 0.06,
                type: "spring",
                stiffness: 320,
                damping: 18,
              }}
            />
          ))}
        </div>
      ))}
      <p className="text-sm text-gray-400 font-bold mt-1">
        {a} groups of {b}
      </p>
    </div>
  );
}

function NumberEquationVisual({ q }: { q: Math5YoQuestion }) {
  if (q.type === "word") {
    return (
      <div className="w-full max-w-4xl rounded-3xl bg-pokemon-yellow/20 border-4 border-pokemon-yellow/30 px-5 py-8">
        <p className="text-4xl font-black text-gray-800 leading-tight">
          {q.wordProblem}
        </p>
      </div>
    );
  }

  const symbol = q.type === "add" ? "+" : q.type === "subtract" ? "−" : "×";

  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-4">
      <span className="min-w-28 rounded-3xl bg-blue-50 border-4 border-blue-200 px-5 py-4 text-8xl font-black leading-none text-blue-700">
        {q.a}
      </span>
      <span className="text-7xl font-black leading-none text-gray-400">
        {symbol}
      </span>
      <span className="min-w-28 rounded-3xl bg-amber-50 border-4 border-amber-200 px-5 py-4 text-8xl font-black leading-none text-amber-700">
        {q.b}
      </span>
      <span className="text-7xl font-black leading-none text-gray-400">=</span>
      <span className="min-w-28 rounded-3xl bg-gray-50 border-4 border-gray-200 px-5 py-4 text-8xl font-black leading-none text-gray-700">
        ?
      </span>
    </div>
  );
}

function QuestionVisual({
  q,
  pokemonId,
  pokemonName,
  is3yo,
}: {
  q: AnyQuestion;
  pokemonId: number;
  pokemonName: string;
  is3yo: boolean;
}) {
  const q3 = q as Math3YoQuestion;
  const q5 = q as Math5YoQuestion;

  if (!is3yo) {
    return <NumberEquationVisual q={q5} />;
  }

  if (q3.type === "count" && q3.count != null) {
    return <CountVisual count={q3.count} id={pokemonId} name={pokemonName} />;
  }
  if (q3.type === "add" || q5.type === "add") {
    return (
      <AddVisual
        a={q3.a ?? 0}
        b={q3.b ?? 0}
        id={pokemonId}
        name={pokemonName}
      />
    );
  }
  if (q3.type === "subtract" || q5.type === "subtract") {
    return (
      <SubtractVisual
        a={q3.a ?? 0}
        b={q3.b ?? 0}
        id={pokemonId}
        name={pokemonName}
      />
    );
  }
  if (q5.type === "multiply") {
    return (
      <MultiplyVisual
        a={q5.a ?? 2}
        b={q5.b ?? 2}
        id={pokemonId}
        name={pokemonName}
      />
    );
  }
  // Word problem — large sprite of the named Pokémon
  return (
    <img
      src={SPRITE(q.pokemonId)}
      onError={onSpriteError}
      alt={pokemonName}
      className="w-56 h-56 object-contain mx-auto drop-shadow-lg"
    />
  );
}

// ─── Wrong-answer explanation overlay (ADR-011) ─────────────────────────────
// Shows the template-generated step-by-step explanation (never LLM), reuses
// the same sprite visuals as the question itself, and holds the next
// question behind a mandatory, no-skip wait: at least 5s (3yo) / 10s (5yo),
// extended until the spoken explanation finishes so it is never cut off.
// Keyed by the caller on the question id so each wrong answer gets a fresh
// timer.
// If narration somehow never reports completion (stalled audio element), never
// hold the child longer than this past the countdown before advancing anyway.
const EXPLANATION_SPEECH_GRACE_SECONDS = 20;

function ExplanationOverlay({
  explanation,
  is3yo,
  speaking,
  pokemonId,
  pokemonName,
  onDone,
}: {
  explanation: ExplanationResult;
  is3yo: boolean;
  speaking: boolean;
  pokemonId: number;
  pokemonName: string;
  onDone: () => void;
}) {
  const { title, steps, visualType, visualData } = explanation;
  const { a, b, count, wordProblem, answer } = visualData;
  const waitSeconds = explanationWaitSeconds(is3yo);
  const [secondsLeft, setSecondsLeft] = useState(waitSeconds);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setSecondsLeft(waitSeconds);
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitSeconds]);

  // Advance once BOTH the mandatory wait has elapsed AND the narration has
  // finished — the explanation is never cut off mid-sentence. A grace-period
  // fallback guarantees we still advance if speech completion never fires.
  useEffect(() => {
    if (secondsLeft > 0) return;
    if (!speaking) {
      onDoneRef.current();
      return;
    }
    const fallback = setTimeout(
      () => onDoneRef.current(),
      EXPLANATION_SPEECH_GRACE_SECONDS * 1000,
    );
    return () => clearTimeout(fallback);
  }, [secondsLeft, speaking]);

  const circumference = 2 * Math.PI * 28;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 w-full bg-gradient-to-br from-amber-50 to-blue-50 border-4 border-amber-200 rounded-3xl p-5 text-center"
    >
      <p className="text-2xl font-black text-amber-700 mb-3">{title}</p>

      <div className="mb-4 flex justify-center">
        {visualType === "count" && count !== undefined && (
          <CountVisual count={count} id={pokemonId} name={pokemonName} />
        )}
        {visualType === "add" && a !== undefined && b !== undefined && (
          <AddVisual a={a} b={b} id={pokemonId} name={pokemonName} />
        )}
        {visualType === "subtract" && a !== undefined && b !== undefined && (
          <SubtractVisual a={a} b={b} id={pokemonId} name={pokemonName} />
        )}
        {visualType === "multiply" && a !== undefined && b !== undefined && (
          <MultiplyVisual a={a} b={b} id={pokemonId} name={pokemonName} />
        )}
        {visualType === "word" && (
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 text-center max-w-2xl">
            <p className="text-2xl font-bold text-gray-800 mb-2">
              {wordProblem}
            </p>
            <p className="text-xl font-black text-purple-600">
              The answer is {answer}.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 text-left mb-4 max-h-64 overflow-y-auto">
        {steps.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
              s.highlight ? "bg-amber-100" : "bg-white/50"
            }`}
          >
            <span className="flex-shrink-0 font-bold text-amber-600 text-lg">
              {s.id}.
            </span>
            <span className="text-lg font-medium text-gray-800">
              {s.text}
            </span>
          </div>
        ))}
      </div>

      {/* Countdown — mandatory wait, no skip button by design (ADR-011). */}
      <div className="mt-5 flex flex-col items-center justify-center gap-3">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={
                circumference * (1 - secondsLeft / waitSeconds)
              }
              className="text-amber-400 transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-black text-amber-600 text-3xl">
            {secondsLeft > 0 ? secondsLeft : "🔊"}
          </div>
        </div>
        <p className="text-lg font-bold text-gray-600">
          {secondsLeft === 0 && speaking
            ? "Listen closely..."
            : "Next question in a moment..."}
        </p>
      </div>
    </motion.div>
  );
}

function getPrompt(
  q: AnyQuestion,
  pokemonName: string,
  is3yo: boolean,
): string {
  const q3 = q as Math3YoQuestion;

  if (is3yo) {
    if (q3.type === "count") return `How many ${pokemonName}?`;
    if (q3.type === "add")
      return `${q3.a} ${pokemonName} + ${q3.b} ${pokemonName} = ?`;
    return `${q3.a} ${pokemonName} − ${q3.b} ${pokemonName} = ?`;
  } else {
    return "";
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MathPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();
  const is3yo = (profile?.age ?? 5) <= 3;

  const [gamePokemon] = useState(() => shuffle(POKEMON_POOL)[0]);

  const [questions] = useState<AnyQuestion[]>(() =>
    selectSessionQuestions(
      is3yo
        ? (math3YoQuestions as AnyQuestion[])
        : (math5YoQuestions as AnyQuestion[]),
      mathHistoryKey(profile?.id, is3yo),
    ),
  );

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [wrong, setWrong] = useState(false);
  // True while the wrong-answer explanation is still being narrated; the
  // countdown will not advance past zero until narration finishes.
  const [explanationSpeaking, setExplanationSpeaking] = useState(false);

  const q = questions[idx];
  // Shuffle answer positions per question — the authored choices arrays put
  // the correct answer in a predictable slot.
  const choices = useMemo(() => shuffle(q.choices), [q]);
  const isWordProblem = (q as Math5YoQuestion).type === "word";
  const displayId = isWordProblem ? q.pokemonId : gamePokemon.id;
  const displayName = isWordProblem ? q.pokemonName : gamePokemon.name;
  const prompt = getPrompt(q, gamePokemon.name, is3yo);

  // Read each question aloud through the configured narration path; the
  // browser falls back to SpeechSynthesis when optional narration is unavailable.
  useEffect(() => {
    if (done) return;
    void speakText(
      spokenText(getSpokenQuestion(q, gamePokemon.name, is3yo)),
      "en",
    );
  }, [q, gamePokemon.name, is3yo, done]);
  useEffect(() => () => stopSpeaking(), []);

  // Warm the audio for this session's questions — both the prompt and the
  // wrong-answer explanation narration — so nothing stalls waiting on TTS.
  useEffect(() => {
    const lines: Array<{ text: string; lang: "en" }> = [];
    for (const qq of questions) {
      lines.push({
        text: spokenText(getSpokenQuestion(qq, gamePokemon.name, is3yo)),
        lang: "en",
      });
      for (const line of getExplanation(qq, is3yo).spokenLines) {
        lines.push({ text: spokenText(line), lang: "en" });
      }
    }
    void prefetch(lines);
  }, [questions, gamePokemon.name, is3yo]);

  const advance = useCallback(() => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      stopSpeaking();
      playFanfare();
      playJingle();
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
      setWrong(false);
    }
  }, [idx, questions.length]);

  const handleAnswer = useCallback(
    async (choice: number) => {
      if (selected !== null) return;
      setSelected(choice);
      const correct = choice === q.answer;
      if (correct) {
        stopSpeaking();
        playCorrect();
        setScore((s) => s + 1);
        if (!is3yo) setStreak((s) => s + 1);
        await logAttempt("math", q.id, true);
        // Correct → short celebratory beat, then auto-advance.
        setTimeout(advance, 1100);
      } else {
        // Positive-only for the 3yo — soft tap instead of the "wrong" cue.
        if (is3yo) playTap();
        else playWrong();
        setStreak(0);
        // Template-generated only — never LLM (ADR-011 / AGENTS.md).
        const explanation = getExplanation(q, is3yo);
        setExplanationSpeaking(true);
        void speakSequence(
          explanation.spokenLines.map((text) => ({
            text: spokenText(text),
            lang: "en" as const,
          })),
        ).finally(() => setExplanationSpeaking(false));
        // Wrong → explanation + mandatory no-skip countdown (ExplanationOverlay
        // calls advance() itself once the countdown finishes AND narration ends).
        setWrong(true);
        await logAttempt("math", q.id, false);
      }
    },
    [selected, q, is3yo, logAttempt, advance],
  );

  // ─── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          {is3yo ? (
            <img
              src={SPRITE(gamePokemon.id)}
              onError={onSpriteError}
              alt={gamePokemon.name}
              className="w-64 h-64 mx-auto mb-4 drop-shadow-xl"
            />
          ) : (
            <div className="w-64 h-64 mx-auto mb-4 rounded-3xl bg-pokemon-yellow/20 border-4 border-pokemon-yellow/40 flex flex-col items-center justify-center">
              <span className="text-8xl font-black leading-none text-pokemon-red">
                {score}
              </span>
              <span className="text-2xl font-black text-gray-600">correct</span>
            </div>
          )}
          <h2 className="text-5xl font-black text-pokemon-red mb-2">
            Great job!
          </h2>
          <p className="text-3xl font-bold text-gray-700 mb-6">
            {score} / {questions.length} correct
          </p>
          <div className="flex gap-1 justify-center mb-8">
            {questions.map((_, i) => (
              <Star
                key={i}
                size={45}
                className={
                  i < score
                    ? "text-pokemon-yellow fill-pokemon-yellow"
                    : "text-gray-300"
                }
              />
            ))}
          </div>
          <button
            onClick={() => navigate("/home")}
            className="bg-pokemon-red text-white text-2xl font-black px-10 py-5 rounded-3xl shadow-lg min-h-[88px]"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── Question screen ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full px-4 py-4">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate("/home")}
          className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={40} />
        </button>
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-500">
            Question {idx + 1} of {questions.length}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
            <div
              className="bg-pokemon-red h-3 rounded-full transition-all"
              style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-pokemon-red">{score}</p>
          <p className="text-sm text-gray-500">pts</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          className="flex flex-col items-center flex-1"
        >
          <div className="bg-white rounded-3xl shadow-md p-5 w-full mb-5 text-center">
            <div className="min-h-[320px] flex items-center justify-center mb-4">
              <QuestionVisual
                q={q}
                pokemonId={displayId}
                pokemonName={displayName}
                is3yo={is3yo}
              />
            </div>
            {prompt && (
              <p className="text-2xl font-black text-gray-800 leading-snug">
                {prompt}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 w-full">
            {choices.map((choice) => {
              let bg = "bg-white border-4 border-gray-200 text-gray-800";
              const sizeClass = is3yo
                ? "py-6 text-4xl min-h-[100px]"
                : "py-7 text-6xl min-h-[120px]";
              if (selected !== null) {
                if (choice === q.answer) {
                  bg = "bg-green-400 border-green-500 text-white";
                } else if (choice === selected) {
                  // No red "wrong" flash for the 3yo profile — positive
                  // framing only (ADR-011). 5yo keeps a gentle red cue.
                  bg = is3yo
                    ? "bg-amber-100 border-amber-300 text-gray-500"
                    : "bg-red-400 border-red-500 text-white";
                }
              }
              const wrongPick =
                selected !== null && choice === selected && choice !== q.answer;
              return (
                <motion.button
                  key={choice}
                  whileTap={{ scale: 0.92 }}
                  // Positive-only for the 3yo: gentle wiggle instead of a red flash.
                  animate={is3yo && wrongPick ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                  transition={is3yo && wrongPick ? { duration: 0.4 } : {}}
                  onClick={() => handleAnswer(choice)}
                  disabled={selected !== null}
                  className={`${bg} rounded-3xl ${sizeClass} font-black shadow transition-all disabled:cursor-default`}
                >
                  {choice}
                </motion.button>
              );
            })}
          </div>

          {wrong && (
            <ExplanationOverlay
              key={q.id}
              explanation={getExplanation(q, is3yo)}
              is3yo={is3yo}
              speaking={explanationSpeaking}
              pokemonId={displayId}
              pokemonName={displayName}
              onDone={advance}
            />
          )}

          {!wrong && !is3yo && streak >= 3 && (
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mt-4 text-2xl font-black text-pokemon-yellow"
            >
              {streak} in a row!
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
