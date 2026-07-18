import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playCorrect, playWrong, playFanfare, playTap } from "@/lib/sound";
import { playJingle } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { spanishQuestions } from "@/content/spanish";

const SPRITE = ARTWORK;

const COLOR_CLASSES: Record<string, string> = {
  rojo: "bg-red-400",
  azul: "bg-blue-400",
  amarillo: "bg-yellow-400",
  verde: "bg-green-400",
  rosa: "bg-pink-400",
};
const COLOR_POKEMON: Record<string, number> = {
  Charmander: 4, Squirtle: 7, Pikachu: 25, Bulbasaur: 1, Jigglypuff: 39,
  Eevee: 133, Meowth: 52, Charizard: 6, Gengar: 94, Umbreon: 197,
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Counting questions render one sprite per unit (same idea as math's
// CountVisual) so a child who counts what is on screen gets the answer right.
function CountVisual({ count, id, name }: { count: number; id: number; name?: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-1 mb-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.img
          key={i}
          src={SPRITE(id)}
          onError={onSpriteError}
          alt={name}
          className="w-36 h-36 object-contain"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.04, type: "spring", stiffness: 320, damping: 18 }}
        />
      ))}
    </div>
  );
}

export default function SpanishPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();
  const is3yo = (profile?.age ?? 5) <= 3;
  const [questions] = useState(() => shuffle(spanishQuestions).slice(0, 10));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [wrong, setWrong] = useState(false);

  const q = questions[idx];
  // Shuffle answer positions per question — the authored choices arrays put
  // the correct answer in a predictable slot.
  const choices = useMemo(() => shuffle(q.choices), [q]);

  // Speak only the Spanish content (the parent found English-then-Spanish
  // narration confusing); the question stays on screen as text.
  useEffect(() => {
    if (done) return;
    if (q.spanishWord) void speakText(q.spanishWord, "es");
    else stopSpeaking();
  }, [q, done]);
  useEffect(() => () => stopSpeaking(), []);

  // Warm the audio for this session's words so pronunciation is instant.
  useEffect(() => {
    void prefetch(
      questions.flatMap((qq) =>
        qq.spanishWord ? [{ text: qq.spanishWord, lang: "es" as const }] : [],
      ),
    );
  }, [questions]);

  const advance = useCallback(() => {
    if (idx + 1 >= questions.length) { setDone(true); stopSpeaking(); playFanfare(); playJingle(); }
    else { setIdx(i => i + 1); setSelected(null); setWrong(false); }
  }, [idx, questions.length]);

  const handleAnswer = useCallback(async (choice: string) => {
    if (selected !== null) return;
    setSelected(choice);
    const correct = choice === q.answer;
    if (correct) { playCorrect(); if (q.spanishWord) void speakText(q.spanishWord, "es"); else stopSpeaking(); }
    // Color-question answers are Pokémon names; spokenName passes Spanish
    // words through untouched (they aren't map keys).
    // Positive-only for the 3yo — soft tap instead of the "wrong" cue.
    else { if (is3yo) playTap(); else playWrong(); void speakText(spokenName(q.answer), "auto"); }
    if (correct) setScore(s => s + 1);
    await logAttempt("spanish", q.id, correct);
    setShowHint(false);
    // Correct → auto-advance. Wrong → hold on the explanation until "Next".
    if (correct) setTimeout(advance, 1200);
    else setWrong(true);
  }, [selected, q, is3yo, logAttempt, advance]);

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
          <img src={SPRITE(133)} onError={onSpriteError} alt="Eevee" className="w-64 h-64 mx-auto mb-4 drop-shadow-xl" />
          <h2 className="text-5xl font-black text-pokemon-blue mb-2">Excelente!</h2>
          <p className="text-3xl font-bold text-gray-700 mb-6">{score} / {questions.length} correct</p>
          <div className="flex gap-1 justify-center mb-8">
            {questions.map((_, i) => (
              <Star key={i} size={45} className={i < score ? "text-pokemon-yellow fill-pokemon-yellow" : "text-gray-300"} />
            ))}
          </div>
          <button
            onClick={() => navigate("/home")}
            className="bg-pokemon-blue text-white text-2xl font-black px-10 py-5 rounded-3xl shadow-lg min-h-[88px]"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-4">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate("/home")} className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={40} />
        </button>
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-500">Question {idx + 1} of {questions.length}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
            <div className="bg-pokemon-blue h-3 rounded-full transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
        <p className="text-2xl font-black text-pokemon-blue">{score} pts</p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
          className="flex flex-col items-center flex-1"
        >
          <div className="bg-pokemon-blue/10 rounded-3xl p-5 w-full mb-5 text-center border-4 border-pokemon-blue/20">
            {q.spanishWord && (
              <div className="text-5xl font-black text-pokemon-blue mb-2">{q.spanishWord.toUpperCase()}</div>
            )}
            {/* For color questions, show a color swatch — NOT the answer
                Pokémon's sprite, which would give the answer away. Other
                question types still show their illustrative Pokémon. */}
            {q.type === "color" ? (
              <div
                className={`${COLOR_CLASSES[q.spanishWord ?? ""] ?? "bg-gray-300"} w-44 h-44 mx-auto mb-2 rounded-full shadow-inner border-8 border-white`}
              />
            ) : q.count != null && q.pokemonId ? (
              <CountVisual count={q.count} id={q.pokemonId} name={q.pokemonName} />
            ) : (
              q.pokemonId && (
                <img src={SPRITE(q.pokemonId)} onError={onSpriteError} alt={q.pokemonName} className="w-60 h-60 mx-auto mb-2" />
              )
            )}
            <p className="text-2xl font-bold text-gray-800">{q.question}</p>
            {showHint && q.hint && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xl text-pokemon-blue font-bold">
                Hint: {q.hint}
              </motion.p>
            )}
          </div>

          {q.type === "color" ? (
            <div className="grid grid-cols-3 gap-4 w-full mb-4">
              {choices.map((choice) => {
                const pokId = COLOR_POKEMON[choice] ?? 25;
                const wrongPick = selected !== null && choice === selected && choice !== q.answer;
                let ring = "ring-4 ring-transparent";
                if (selected !== null) {
                  if (choice === q.answer) ring = "ring-4 ring-green-500";
                  // Positive-only for the 3yo: card stays neutral and wiggles gently, no red flash.
                  else if (wrongPick && !is3yo) ring = "ring-4 ring-red-500";
                }
                return (
                  <motion.button
                    key={choice} whileTap={{ scale: 0.92 }}
                    animate={is3yo && wrongPick ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                    transition={is3yo && wrongPick ? { duration: 0.4 } : {}}
                    onClick={() => handleAnswer(choice)}
                    className={`bg-white rounded-3xl p-3 shadow flex flex-col items-center gap-1 ${ring} transition-all min-h-[120px]`}
                  >
                    <img src={SPRITE(pokId)} onError={onSpriteError} alt={choice} className="w-44 h-44 object-contain" />
                    <span className="text-lg font-black text-gray-800">{choice}</span>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              {choices.map((choice) => {
                const wrongPick = selected !== null && choice === selected && choice !== q.answer;
                let bg = "bg-white border-4 border-gray-200";
                if (selected !== null) {
                  if (choice === q.answer) bg = "bg-green-400 border-green-500 text-white";
                  // Positive-only for the 3yo: card stays neutral and wiggles gently, no red flash.
                  else if (wrongPick && !is3yo) bg = "bg-red-400 border-red-500 text-white";
                }
                return (
                  <motion.button
                    key={choice} whileTap={{ scale: 0.97 }}
                    animate={is3yo && wrongPick ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                    transition={is3yo && wrongPick ? { duration: 0.4 } : {}}
                    onClick={() => handleAnswer(choice)}
                    className={`${bg} rounded-3xl py-5 text-2xl font-black shadow text-gray-800 transition-all min-h-[88px]`}
                  >
                    {choice}
                  </motion.button>
                );
              })}
            </div>
          )}

          {wrong && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 w-full bg-amber-50 border-4 border-amber-200 rounded-3xl p-5 text-center"
            >
              <p className="text-xl font-black text-amber-700 mb-1">{is3yo ? "Good try!" : "Not quite!"}</p>
              <p className="text-2xl font-black text-gray-800 mb-1">The answer is {q.answer}.</p>
              {q.hint && <p className="text-xl font-bold text-pokemon-blue mb-4">{q.hint}</p>}
              <button
                onClick={advance}
                className="bg-pokemon-blue text-white text-2xl font-black px-10 py-4 rounded-2xl shadow min-h-[88px]"
              >
                Next →
              </button>
            </motion.div>
          )}

          {!wrong && !showHint && q.hint && selected === null && (
            <button
              onClick={() => setShowHint(true)}
              className="mt-4 bg-white border-4 border-pokemon-blue/30 text-pokemon-blue text-2xl font-black px-10 rounded-3xl shadow min-h-[88px]"
            >
              Need a hint?
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
