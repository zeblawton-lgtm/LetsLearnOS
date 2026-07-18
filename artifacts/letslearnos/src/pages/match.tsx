// Memory-match (concentration) module — /match
// Ages 3 (4 pairs, 4×2) and 5 (8 pairs, 4×4).
// Positive feedback only; mismatch flips back gently, no "wrong" sound.

import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { pokedex } from "@/content/pokedex";

const SPRITE = ARTWORK;

// All candidate Pokémon ids for the match pool.
const POOL_IDS = [25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 52, 54, 129, 35, 94, 175];

// Build a lookup from id → name using the bundled pokedex.
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

interface CardData {
  uid: string;   // unique per card slot (pairId + "a" | "b")
  pairId: string; // shared by the two matching cards
  pokemonId: number;
}

function buildBoard(pairs: number): CardData[] {
  const ids = shuffle(POOL_IDS).slice(0, pairs);
  const cards: CardData[] = ids.flatMap((id, i) => {
    const pairId = `pair-${i}`;
    return [
      { uid: `${pairId}-a`, pairId, pokemonId: id },
      { uid: `${pairId}-b`, pairId, pokemonId: id },
    ];
  });
  return shuffle(cards);
}

// ─── Pokéball back-face (pure CSS, no extra assets) ──────────────────────────
function PokeballBack() {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative select-none"
      style={{ background: "linear-gradient(to bottom, #e53935 50%, #fafafa 50%)" }}>
      {/* centre band */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-[10%] bg-[#212121]" />
      </div>
      {/* centre circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[28%] h-[28%] rounded-full bg-[#212121] flex items-center justify-center">
          <div className="w-[60%] h-[60%] rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Single card ─────────────────────────────────────────────────────────────
interface CardProps {
  card: CardData;
  flipped: boolean;
  matched: boolean;
  onClick: (uid: string) => void;
}

function MatchCard({ card, flipped, matched, onClick }: CardProps) {
  const faceUp = flipped || matched;

  return (
    <motion.button
      onClick={() => onClick(card.uid)}
      disabled={matched || flipped}
      className="relative focus:outline-none w-full h-full block"
      style={{ perspective: 900 }}
      // Pop when matched
      animate={matched ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={matched ? { duration: 0.4, ease: "easeOut" } : {}}
      aria-label={faceUp ? pokeName(card.pokemonId) : "Hidden card"}
    >
      {/* 3-D flip wrapper */}
      <motion.div
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={{ duration: 0.38, ease: "easeInOut" }}
        style={{
          transformStyle: "preserve-3d",
          width: "100%",
          height: "100%",
        }}
        className="w-full h-full"
      >
        {/* Back face */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <PokeballBack />
        </div>

        {/* Front face */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: matched
              ? "linear-gradient(135deg, #d4f8d4 0%, #a8f0a8 100%)"
              : "linear-gradient(135deg, #f0f8ff 0%, #dceeff 100%)",
          }}
        >
          <img
            src={SPRITE(card.pokemonId)}
            onError={onSpriteError}
            alt={pokeName(card.pokemonId)}
            className="w-[80%] h-[80%] object-contain drop-shadow-md pointer-events-none"
          />
        </div>
      </motion.div>
    </motion.button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MatchPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;
  const PAIRS = is3yo ? 4 : 8;

  // Game state
  const [board, setBoard] = useState<CardData[]>(() => buildBoard(PAIRS));
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [flipCount, setFlipCount] = useState(0);
  const [done, setDone] = useState(false);
  const [pairsFound, setPairsFound] = useState(0);

  // Lock input while resolving a mismatch
  const locked = useRef(false);
  // The one card currently face-up (awaiting a second tap)
  const firstCard = useRef<CardData | null>(null);

  // Prefetch Pokémon names on mount
  useEffect(() => {
    const ids = Array.from(new Set(board.map((c) => c.pokemonId)));
    void prefetch(ids.map((id) => ({ text: spokenName(pokeName(id)), lang: "en" as const })));
    return () => stopSpeaking();
  }, [board]);

  const startNewGame = useCallback(() => {
    stopSpeaking();
    // "Play Again" stays on this route, so App's route effect never runs —
    // without this the completion song keeps playing through the new game.
    stopMusic();
    locked.current = false;
    firstCard.current = null;
    setBoard(buildBoard(PAIRS));
    setFlipped(new Set());
    setMatched(new Set());
    setFlipCount(0);
    setPairsFound(0);
    setDone(false);
  }, [PAIRS]);

  const handleCardClick = useCallback((uid: string) => {
    if (locked.current) return;
    if (matched.has(uid)) return;
    if (flipped.has(uid)) return;

    playTap();
    setFlipCount((n) => n + 1);

    const clickedCard = board.find((c) => c.uid === uid)!;

    if (!firstCard.current) {
      // First card of pair
      firstCard.current = clickedCard;
      setFlipped((prev) => new Set([...prev, uid]));
      return;
    }

    // Second card
    const first = firstCard.current;
    firstCard.current = null;
    setFlipped((prev) => new Set([...prev, uid]));

    if (first.pairId === clickedCard.pairId) {
      // Match!
      playCorrect();
      void speakText(spokenName(pokeName(clickedCard.pokemonId)), "en");

      const newMatched = new Set([...matched, first.uid, clickedCard.uid]);
      setMatched(newMatched);
      setFlipped(new Set()); // clear the transient flipped set; matched set tracks them

      const newFound = pairsFound + 1;
      setPairsFound(newFound);

      if (newFound >= PAIRS) {
        // All pairs found — completion
        setTimeout(() => {
          playFanfare();
          playJingle();
          void logAttempt("match", `match-${PAIRS}pairs`, true);
          setDone(true);
        }, 600);
      }
    } else {
      // Mismatch — lock, wait, flip back
      locked.current = true;
      setTimeout(() => {
        playTap(); // gentle soft sound, not wrong/negative
        setFlipped(new Set());
        locked.current = false;
      }, 900);
    }
  }, [board, flipped, matched, pairsFound, PAIRS, logAttempt]);

  // ── Grid layout ──────────────────────────────────────────────────────────
  // The kiosk is landscape (~1920×969 CSS px), so spread the cards wide and
  // keep only 2 rows — that's what maximises card size: 4×2 for the 3yo
  // (~340 px cards), 8×2 for the 5yo (~215 px cards). A 4×4 grid would be
  // height-bound at ~160 px cards.
  const cols = is3yo ? 4 : 8;
  const rows = (PAIRS * 2) / cols;

  // ── Completion screen ────────────────────────────────────────────────────
  if (done) {
    const celebPoke = board.find((c) => c.uid.endsWith("-a"))!;
    const positiveNote =
      flipCount <= PAIRS * 2 + 2
        ? "Amazing memory!"
        : flipCount <= PAIRS * 3
        ? "Super memory!"
        : "Great job!";

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src={SPRITE(celebPoke.pokemonId)}
            onError={onSpriteError}
            alt={pokeName(celebPoke.pokemonId)}
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />

          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">
            You found them all!
          </h2>
          <p className="text-3xl font-bold text-gray-600">
            {positiveNote} — {flipCount} flips for {PAIRS} pairs.
          </p>

          {/* One star per pair, all filled — positive only */}
          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {Array.from({ length: PAIRS }).map((_, i) => (
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
              onClick={startNewGame}
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

  // ── Game screen ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full px-4 py-4 gap-3">

      {/* Header */}
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
            Memory Match
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            Pairs found: {pairsFound} / {PAIRS}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
            <motion.div
              className="bg-pokemon-blue h-3 rounded-full"
              animate={{ width: `${(pairsFound / PAIRS) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            // Width-driven sizing in viewport units — percentage heights
            // don't resolve here (the page's h-full chain sits under a
            // min-h-screen parent, so they collapse to auto and the cards
            // shrink to their 88px minimums). Width is definite, and
            // aspect-ratio derives the height from it reliably.
            width: `min(94vw, calc(72vh * ${cols} / ${rows}))`,
            aspectRatio: `${cols} / ${rows}`,
          }}
        >
          <AnimatePresence>
            {board.map((card) => (
              <motion.div
                key={card.uid}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="min-w-[88px] min-h-[88px]"
              >
                <MatchCard
                  card={card}
                  flipped={flipped.has(card.uid)}
                  matched={matched.has(card.uid)}
                  onClick={handleCardClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
