// ---------------------------------------------------------------------------
// shadow.tsx — Shadow Match module (route /shadow)
//
// Shows a large dark silhouette of a bundled Pokémon (drawn on a <canvas>
// using globalCompositeOperation "source-in" so the fill exactly follows the
// artwork's alpha shape) and asks "Whose shadow is this?". Three big
// full-colour answer buttons let the child guess; a correct tap dissolves
// the silhouette into the real artwork. A session is 8 rounds drawn from a
// kid-friendly pool where every entry comes from a different evolution
// family, so the three on-screen options in a round are never confusable
// "lookalikes" (Pikachu/Raichu, Growlithe/Arcanine, Gastly/Gengar, etc. never
// appear together).
//
// Positive feedback only — a wrong tap just wiggles that button and shows a
// gentle "Try again!" caption; the button stays enabled and nothing turns
// red or plays a negative sound.
// ---------------------------------------------------------------------------

import { ARTWORK, SPRITE_FALLBACK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { pokedex } from "@/content/pokedex";
import { useSession } from "@/context/SessionContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPRITE = ARTWORK;

// Kid-friendly pool — one Pokémon per evolution family (no two members of the
// same line appear here), so any three ids drawn together for a round are
// always shape-distinct — no lookalike trios to confuse the silhouette.
const POOL_IDS = [
  25, 1, 4, 7, 39, 143, 133, 151, 94, 129,
  54, 52, 35, 175, 113, 37, 58, 60, 79, 145,
];

const ROUND_COUNT = 8;
const OPTION_COUNT = 3;

const NAME_MAP = new Map<number, string>(pokedex.map((e) => [e.id, e.name]));
function pokeName(id: number): string {
  return NAME_MAP.get(id) ?? `Pokémon #${id}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build one round's on-screen option set: the correct id plus two distinct
// distractors from the pool, shuffled into random button order.
function buildOptions(correctId: number): number[] {
  const distractors = shuffle(POOL_IDS.filter((id) => id !== correctId)).slice(
    0,
    OPTION_COUNT - 1,
  );
  return shuffle([correctId, ...distractors]);
}

// ---------------------------------------------------------------------------
// SilhouetteCanvas — draws the bundled artwork onto an offscreen-sized
// canvas, then flattens its alpha shape to a single dark-slate fill via
// globalCompositeOperation "source-in". Falls back to silhouetting the
// bundled neutral SVG if the artwork PNG is missing, so the round always
// has something to show (offline-first, no network).
// ---------------------------------------------------------------------------
function SilhouetteCanvas({ pokemonId }: { pokemonId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    function paint(src: string, onFail?: () => void) {
      const img = new Image();
      img.onload = () => {
        if (cancelled || !canvas || !ctx) return;
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = "#334155"; // slate-700 — dark but soft, not pure black
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "source-over";
      };
      img.onerror = () => {
        if (!cancelled && onFail) onFail();
      };
      img.src = src;
    }

    paint(ARTWORK(pokemonId), () => paint(SPRITE_FALLBACK));

    return () => {
      cancelled = true;
    };
  }, [pokemonId]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full h-full pointer-events-none select-none"
    />
  );
}

// ---------------------------------------------------------------------------
// ShadowRound — one silhouette + three answer buttons.
// ---------------------------------------------------------------------------

interface RoundProps {
  pokemonId: number;
  optionIds: number[];
  onComplete: () => void;
}

function ShadowRound({ pokemonId, optionIds, onComplete }: RoundProps) {
  const { logAttempt } = useSession();

  const [revealed, setRevealed] = useState(false);
  const [wiggleId, setWiggleId] = useState<number | null>(null);
  const [showTryAgain, setShowTryAgain] = useState(false);

  const name = pokeName(pokemonId);

  // Ask the question once this round mounts.
  useEffect(() => {
    void speakText("Whose shadow is this?", "en");
  }, [pokemonId]);

  const handleGuess = useCallback(
    (id: number) => {
      if (revealed) return;
      playTap();

      if (id === pokemonId) {
        setRevealed(true);
        playCorrect();
        void speakText(`It's ${spokenName(name)}!`, "en");
        void logAttempt("shadow", `shadow-${pokemonId}`, true);
      } else {
        // Gentle wiggle + "Try again!" — the button stays enabled, no
        // negative sound or colour.
        setWiggleId(id);
        setShowTryAgain(true);
        setTimeout(() => setWiggleId(null), 500);
        setTimeout(() => setShowTryAgain(false), 1200);
      }
    },
    [revealed, pokemonId, name, logAttempt],
  );

  return (
    <div className="flex flex-col items-center flex-1 gap-4 w-full">
      {/* Silhouette panel */}
      <div
        className="relative bg-white rounded-3xl shadow-xl border-4 border-gray-100 overflow-hidden shrink-0"
        style={{ width: "min(42vh, 40vw)", height: "min(42vh, 40vw)" }}
      >
        <motion.div
          className="absolute pointer-events-none select-none"
          style={{ inset: "8%", width: "84%", height: "84%" }}
          animate={{ opacity: revealed ? 0 : 1 }}
          transition={{ duration: 0.5 }}
        >
          <SilhouetteCanvas pokemonId={pokemonId} />
        </motion.div>

        <motion.img
          src={SPRITE(pokemonId)}
          onError={onSpriteError}
          alt={revealed ? name : ""}
          aria-hidden={!revealed}
          draggable={false}
          className="absolute object-contain pointer-events-none select-none"
          style={{ inset: "8%", width: "84%", height: "84%" }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: revealed ? 1 : 0, scale: revealed ? 1 : 0.8 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 140 }}
        />
      </div>

      {/* Caption row — fixed height so nothing jumps when text appears */}
      <div className="h-10 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {revealed ? (
            <motion.p
              key="name"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-pokemon-blue"
            >
              {name}!
            </motion.p>
          ) : showTryAgain ? (
            <motion.p
              key="try-again"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-2xl font-black text-pokemon-blue"
            >
              Try again!
            </motion.p>
          ) : (
            <motion.p
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xl font-bold text-gray-500"
            >
              Whose shadow is this?
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Answer buttons */}
      <div className="flex gap-6 flex-wrap justify-center">
        {optionIds.map((id) => {
          const isCorrectChoice = revealed && id === pokemonId;
          return (
            <motion.button
              key={id}
              onClick={() => handleGuess(id)}
              disabled={revealed}
              aria-label={pokeName(id)}
              className={[
                "flex items-center justify-center rounded-3xl bg-white shadow-xl border-4 p-3",
                "min-w-[120px] min-h-[120px] transition-colors",
                isCorrectChoice ? "border-pokemon-yellow" : "border-gray-100",
              ].join(" ")}
              style={{ width: "clamp(140px, 18vw, 210px)", height: "clamp(140px, 18vw, 210px)" }}
              animate={wiggleId === id ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
              whileTap={revealed ? {} : { scale: 0.93 }}
              transition={wiggleId === id ? { duration: 0.4 } : {}}
            >
              <img
                src={SPRITE(id)}
                onError={onSpriteError}
                alt={pokeName(id)}
                draggable={false}
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            </motion.button>
          );
        })}
      </div>

      {/* Next button appears once the child finds the right shadow */}
      <AnimatePresence>
        {revealed && (
          <motion.button
            key="next"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={onComplete}
            className="bg-pokemon-blue text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-lg min-h-[88px] min-w-[220px] active:scale-95 transition-transform"
          >
            Next →
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShadowPage (exported default)
// ---------------------------------------------------------------------------

export default function ShadowPage() {
  const [, navigate] = useLocation();

  const [sessionIds, setSessionIds] = useState<number[]>(() =>
    shuffle(POOL_IDS).slice(0, ROUND_COUNT),
  );
  const [roundOptions, setRoundOptions] = useState<number[][]>(() =>
    sessionIds.map((id) => buildOptions(id)),
  );

  const [roundIdx, setRoundIdx] = useState(0);
  const [done, setDone] = useState(false);

  // Prefetch every phrase this session will speak.
  useEffect(() => {
    const phrases = [
      { text: "Whose shadow is this?", lang: "en" as const },
      ...sessionIds.map((id) => ({
        text: `It's ${spokenName(pokeName(id))}!`,
        lang: "en" as const,
      })),
    ];
    void prefetch(phrases);
    return () => stopSpeaking();
  }, [sessionIds]);

  const handleRoundComplete = useCallback(() => {
    if (roundIdx + 1 >= ROUND_COUNT) {
      stopSpeaking();
      playFanfare();
      playJingle();
      setDone(true);
    } else {
      setRoundIdx((i) => i + 1);
    }
  }, [roundIdx]);

  const startNewRound = useCallback(() => {
    stopSpeaking();
    // "Play Again" stays on this route, so App's route effect never runs —
    // without this the completion jingle keeps playing through the new round.
    stopMusic();
    const nextIds = shuffle(POOL_IDS).slice(0, ROUND_COUNT);
    setSessionIds(nextIds);
    setRoundOptions(nextIds.map((id) => buildOptions(id)));
    setRoundIdx(0);
    setDone(false);
  }, []);

  // ── Completion screen ────────────────────────────────────────────────────
  if (done) {
    const celebId = sessionIds[sessionIds.length - 1];
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src={SPRITE(celebId)}
            onError={onSpriteError}
            alt={pokeName(celebId)}
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />

          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">
            You found them all!
          </h2>
          <p className="text-3xl font-bold text-gray-600">Super shadow spotting!</p>

          {/* One star per round, all filled — positive only */}
          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {Array.from({ length: ROUND_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 300 }}
              >
                <Star size={48} className="text-pokemon-yellow fill-pokemon-yellow" />
              </motion.div>
            ))}
          </div>

          <div className="flex gap-6 mt-4 flex-wrap justify-center">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={startNewRound}
              className="bg-pokemon-blue text-white text-3xl font-black px-12 py-6 rounded-3xl shadow-xl min-h-[88px] min-w-[220px]"
            >
              Play Again
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => navigate("/home")}
              className="bg-gray-200 text-gray-700 text-3xl font-black px-12 py-6 rounded-3xl shadow-xl min-h-[88px] min-w-[220px]"
            >
              Back to Home
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Active round screen ──────────────────────────────────────────────────
  const currentId = sessionIds[roundIdx];
  const currentOptions = roundOptions[roundIdx];

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-3">
      {/* Header: back button + progress bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/home")}
          className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200"
          aria-label="Back to Home"
        >
          <ArrowLeft size={44} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black text-pokemon-blue leading-tight">
            Shadow Match
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            Shadow {roundIdx + 1} of {ROUND_COUNT}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
            <motion.div
              className="bg-pokemon-blue h-3 rounded-full"
              animate={{ width: `${((roundIdx + 1) / ROUND_COUNT) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Play area — keyed on roundIdx so it fully remounts per round */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={roundIdx}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center flex-1 w-full"
          >
            <ShadowRound
              pokemonId={currentId}
              optionIds={currentOptions}
              onComplete={handleRoundComplete}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
