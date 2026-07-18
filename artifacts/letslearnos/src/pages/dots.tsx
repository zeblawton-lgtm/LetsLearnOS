// ---------------------------------------------------------------------------
// dots.tsx — Connect-the-Dots module (route /dots)
//
// Generates dot positions at runtime from the bundled Pokémon official artwork
// outlines via extractOutlinePoints (src/lib/contour.ts). A session is 5
// puzzles; each puzzle reveals the Pokémon when the last dot is connected.
//
// Ages: 3 yo gets 8 dots per puzzle; 5 yo gets 14 dots per puzzle.
// Positive feedback only — wrong taps get a gentle wiggle, nothing else.
// ---------------------------------------------------------------------------

import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { extractOutlinePoints } from "@/lib/contour";
import { pokedex } from "@/content/pokedex";
import { useSession } from "@/context/SessionContext";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPRITE = ARTWORK;

// Pokédex IDs used in this module.
const POOL_IDS = [25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 54, 129, 35, 52, 113, 175];

// Session length
const SESSION_SIZE = 5;

// Board margin as a fraction of board size (keeps dots away from the edge).
const MARGIN_FRAC = 0.08;

// ---------------------------------------------------------------------------
// Dot colours per puzzle index
// ---------------------------------------------------------------------------
const DOT_BORDER_COLORS = [
  "border-blue-500",
  "border-purple-500",
  "border-green-500",
  "border-orange-500",
  "border-pink-500",
];
const DOT_FILL_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
];

// ---------------------------------------------------------------------------
// Fallback star polygon (10 points, normalised 0..1)
// Used when extractOutlinePoints returns null.
// ---------------------------------------------------------------------------
function starPolygon(n: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.45 : 0.22;
    pts.push({
      x: 0.5 + r * Math.cos(angle),
      y: 0.5 + r * Math.sin(angle),
    });
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pokemonName(id: number): string {
  return pokedex.find((e) => e.id === id)?.name ?? `#${id}`;
}

// ---------------------------------------------------------------------------
// PuzzleBoard
// ---------------------------------------------------------------------------

interface PuzzleProps {
  pokemonId: number;
  dotCount: number;
  puzzleIndex: number; // 0-based, for colour theming
  onComplete: () => void;
}

function PuzzleBoard({ pokemonId, dotCount, puzzleIndex, onComplete }: PuzzleProps) {
  const { logAttempt } = useSession();

  // Dot positions in 0..1, loaded asynchronously.
  const [points, setPoints] = useState<Array<{ x: number; y: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  // How many dots have been correctly tapped so far.
  const [tapped, setTapped] = useState(0);

  // Which dot index is currently doing a wrong-tap wiggle animation.
  const [wiggleIdx, setWiggleIdx] = useState<number | null>(null);

  // Has the user finished all dots and confirmed the reveal?
  const [revealed, setRevealed] = useState(false);

  // Board DOM ref for measuring board size.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(0);

  const name = pokemonName(pokemonId);
  const borderColor = DOT_BORDER_COLORS[puzzleIndex % DOT_BORDER_COLORS.length];
  const fillColor = DOT_FILL_COLORS[puzzleIndex % DOT_FILL_COLORS.length];

  // -------------------------------------------------------------------------
  // Measure board size (board is a CSS square, so width == height)
  // -------------------------------------------------------------------------
  // Re-measure when `loading` flips: the board div only exists once the
  // outline has loaded (the loading branch renders a spinner instead).
  useEffect(() => {
    function measure() {
      if (boardRef.current) {
        setBoardPx(boardRef.current.getBoundingClientRect().width);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loading]);

  // -------------------------------------------------------------------------
  // Extract outline points when the puzzle mounts.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTapped(0);
    setRevealed(false);

    void (async () => {
      const url = SPRITE(pokemonId);
      const pts = await extractOutlinePoints(url, dotCount);
      if (cancelled) return;
      setPoints(pts ?? starPolygon(Math.min(dotCount, 10)));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [pokemonId, dotCount]);

  // -------------------------------------------------------------------------
  // Convert normalised 0..1 coords to CSS px within the board with margin.
  // -------------------------------------------------------------------------
  function toPx(norm: number, boardSize: number): number {
    const inner = boardSize * (1 - 2 * MARGIN_FRAC);
    return boardSize * MARGIN_FRAC + norm * inner;
  }

  // -------------------------------------------------------------------------
  // Tap handler
  // -------------------------------------------------------------------------
  const handleDotTap = useCallback(
    (idx: number) => {
      if (revealed || points === null) return;
      if (idx !== tapped) {
        // Wrong dot — wiggle only.
        setWiggleIdx(idx);
        setTimeout(() => setWiggleIdx(null), 500);
        return;
      }
      // Correct dot.
      playTap();
      void speakText(String(idx + 1), "en");
      setTapped(idx + 1);

      if (idx + 1 >= points.length) {
        // All dots connected — reveal the Pokémon.
        setRevealed(true);
        playCorrect();
        void speakText(`It's ${spokenName(name)}!`, "en");
        void logAttempt("dots", `dots-${pokemonId}`, true);
      }
    },
    [tapped, points, revealed, name, pokemonId, logAttempt],
  );

  // -------------------------------------------------------------------------
  // SVG lines connecting tapped dots (rendered under the buttons)
  // -------------------------------------------------------------------------
  const lines = useMemo(() => {
    if (!points || boardPx === 0 || tapped < 2) return null;
    const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 1; i < tapped; i++) {
      segs.push({
        x1: toPx(points[i - 1].x, boardPx),
        y1: toPx(points[i - 1].y, boardPx),
        x2: toPx(points[i].x, boardPx),
        y2: toPx(points[i].y, boardPx),
      });
    }
    // If all connected, also draw the closing segment back to dot 0.
    if (tapped === points.length) {
      const last = points[tapped - 1];
      const first = points[0];
      segs.push({
        x1: toPx(last.x, boardPx),
        y1: toPx(last.y, boardPx),
        x2: toPx(first.x, boardPx),
        y2: toPx(first.y, boardPx),
      });
    }
    return segs;
  }, [tapped, points, boardPx]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-24 h-24 rounded-full border-8 border-pokemon-blue border-t-transparent"
        />
        <p className="text-3xl font-black text-pokemon-blue">Getting ready...</p>
      </div>
    );
  }

  if (!points) return null;

  const totalDots = points.length;

  return (
    <div className="flex flex-col items-center flex-1 gap-4 w-full">
      {/* Board */}
      <div
        ref={boardRef}
        className="relative bg-white rounded-3xl shadow-xl border-4 border-gray-100 overflow-hidden"
        style={{
          width: "min(66vh, 60vw)",
          height: "min(66vh, 60vw)",
          flexShrink: 0,
        }}
      >
        {/* Faint watermark of the artwork — helps 3yo recognise the shape.
            Same inset box as the dots (toPx applies MARGIN_FRAC), and the
            contour points use object-contain geometry, so dots sit right on
            this image's outline. */}
        <img
          src={SPRITE(pokemonId)}
          onError={onSpriteError}
          alt=""
          aria-hidden="true"
          className="absolute w-auto h-auto object-contain pointer-events-none select-none opacity-10 grayscale"
          style={{ inset: `${MARGIN_FRAC * 100}%`, width: `${(1 - 2 * MARGIN_FRAC) * 100}%`, height: `${(1 - 2 * MARGIN_FRAC) * 100}%` }}
        />

        {/* Reveal: full-colour artwork fades in after all dots are tapped */}
        <AnimatePresence>
          {revealed && (
            <motion.img
              key="reveal"
              src={SPRITE(pokemonId)}
              onError={onSpriteError}
              alt={name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 140 }}
              className="absolute object-contain pointer-events-none select-none z-20"
              style={{ inset: `${MARGIN_FRAC * 100}%`, width: `${(1 - 2 * MARGIN_FRAC) * 100}%`, height: `${(1 - 2 * MARGIN_FRAC) * 100}%` }}
            />
          )}
        </AnimatePresence>

        {/* SVG connection lines */}
        {boardPx > 0 && lines && (
          <AnimatePresence>
            {!revealed && (
              <motion.svg
                key="lines"
                className="absolute inset-0 pointer-events-none z-10"
                width={boardPx}
                height={boardPx}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {lines.map((seg, i) => (
                  <line
                    key={i}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke="#3b82f6"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                ))}
              </motion.svg>
            )}
          </AnimatePresence>
        )}

        {/* Dots — hidden after reveal */}
        <AnimatePresence>
          {!revealed &&
            boardPx > 0 &&
            points.map((pt, i) => {
              const cx = toPx(pt.x, boardPx);
              const cy = toPx(pt.y, boardPx);
              const isTapped = i < tapped;
              const isNext = i === tapped;
              const isWiggling = wiggleIdx === i;

              return (
                <motion.button
                  key={i}
                  // Position: centre the 88px hit-target on the dot coordinate.
                  // The expected next dot stacks above its neighbours so it
                  // wins the tap when 88px hit targets overlap.
                  style={{
                    position: "absolute",
                    left: cx - 44,
                    top: cy - 44,
                    width: 88,
                    height: 88,
                    zIndex: isNext ? 20 : 10,
                  }}
                  className="flex items-center justify-center focus:outline-none"
                  onClick={() => handleDotTap(i)}
                  aria-label={`Dot ${i + 1}`}
                  // Wiggle animation for wrong taps — no harsh sound.
                  animate={
                    isWiggling
                      ? { x: [0, -8, 8, -6, 6, 0] }
                      : {}
                  }
                  transition={isWiggling ? { duration: 0.4 } : {}}
                >
                  {/* Visual circle inside the 88px hit target */}
                  <motion.div
                    className={[
                      "flex items-center justify-center rounded-full border-4 select-none",
                      "text-lg font-black",
                      isTapped
                        ? `${fillColor} text-white border-transparent shadow-md`
                        : `bg-white ${borderColor} text-gray-700 shadow`,
                    ].join(" ")}
                    style={{ width: 64, height: 64, pointerEvents: "none" }}
                    // Pulse the next-expected dot to guide the child.
                    animate={
                      isNext && !isTapped
                        ? { scale: [1, 1.18, 1] }
                        : { scale: 1 }
                    }
                    transition={
                      isNext && !isTapped
                        ? { repeat: Infinity, duration: 0.9, ease: "easeInOut" }
                        : {}
                    }
                  >
                    {i + 1}
                  </motion.div>
                </motion.button>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Post-reveal: name label + Next button */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            key="next"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-col items-center gap-4 mt-2"
          >
            <p className="text-4xl font-black text-pokemon-blue drop-shadow">{name}!</p>
            <button
              onClick={onComplete}
              className="bg-pokemon-blue text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-lg min-h-[88px] min-w-[220px] active:scale-95 transition-transform"
            >
              Next →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress hint: "X / Y dots" */}
      {!revealed && (
        <p className="text-xl font-bold text-gray-500">
          {tapped} / {totalDots} dots
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DotsPage (exported default)
// ---------------------------------------------------------------------------

export default function DotsPage() {
  const { profile } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;
  const dotCount = is3yo ? 8 : 14;

  // Pick and shuffle 5 random Pokémon IDs for the session (no repeats).
  const [puzzleIds] = useState<number[]>(() =>
    shuffle(POOL_IDS).slice(0, SESSION_SIZE),
  );

  // Current puzzle index (0-based).
  const [puzzleIdx, setPuzzleIdx] = useState(0);

  // Whether the session is complete.
  const [done, setDone] = useState(false);

  // -------------------------------------------------------------------------
  // Prefetch TTS for numbers 1..14 (done once on mount).
  // -------------------------------------------------------------------------
  useEffect(() => {
    const utterances = Array.from({ length: 14 }, (_, i) => ({
      text: String(i + 1),
      lang: "en" as const,
    }));
    void prefetch(utterances);
    return () => { stopSpeaking(); };
  }, []);

  // -------------------------------------------------------------------------
  // Advance to next puzzle or finish session.
  // -------------------------------------------------------------------------
  const handlePuzzleComplete = useCallback(() => {
    if (puzzleIdx + 1 >= SESSION_SIZE) {
      setDone(true);
      stopSpeaking();
      playFanfare();
      playJingle();
    } else {
      setPuzzleIdx((i) => i + 1);
    }
  }, [puzzleIdx]);

  // -------------------------------------------------------------------------
  // Done screen
  // -------------------------------------------------------------------------
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="flex flex-col items-center gap-6"
        >
          <img
            src={SPRITE(25)}
            onError={onSpriteError}
            alt="Pikachu"
            className="w-56 h-56 mx-auto drop-shadow-xl"
          />
          <h2 className="text-5xl font-black text-pokemon-blue">Amazing job!</h2>
          <p className="text-2xl font-bold text-gray-700">
            You connected all {SESSION_SIZE} Pokémon!
          </p>

          {/* Stars — one per completed puzzle, all filled (positive only) */}
          <div className="flex gap-2 justify-center">
            {Array.from({ length: SESSION_SIZE }).map((_, i) => (
              <Star
                key={i}
                size={52}
                className="text-pokemon-yellow fill-pokemon-yellow drop-shadow"
              />
            ))}
          </div>

          <button
            onClick={() => navigate("/home")}
            className="bg-pokemon-blue text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-lg min-h-[88px]"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Active puzzle screen
  // -------------------------------------------------------------------------
  const currentId = puzzleIds[puzzleIdx];

  return (
    <div className="flex flex-col h-full px-4 py-4">
      {/* Header: back button + progress bar */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate("/home")}
          className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0"
          aria-label="Back to Home"
        >
          <ArrowLeft size={40} />
        </button>
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-500">
            Puzzle {puzzleIdx + 1} of {SESSION_SIZE}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
            <div
              className="bg-pokemon-blue h-3 rounded-full transition-all"
              style={{ width: `${((puzzleIdx + 1) / SESSION_SIZE) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Puzzle board — keyed on puzzleIdx so it fully remounts per puzzle */}
      <AnimatePresence mode="wait">
        <motion.div
          key={puzzleIdx}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center flex-1"
        >
          <PuzzleBoard
            pokemonId={currentId}
            dotCount={dotCount}
            puzzleIndex={puzzleIdx}
            onComplete={handlePuzzleComplete}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
