// ---------------------------------------------------------------------------
// puzzle.tsx — Jigsaw Puzzle module (route /puzzle)
//
// Slices a bundled Pokémon artwork into a small grid of rectangular pieces
// (CSS background-position tiles, no canvas needed) and lets the child drag
// each piece from a side tray onto a faded guide board. A generous snap
// radius locks a piece the moment it's dropped anywhere near its slot.
//
// Ages: 3yo gets a fixed 2x2 (4 pieces). 5yo defaults to 3x2 (6 pieces) with
// an optional 3x3 (9 pieces) chooser. Completing the picture pops the full
// artwork in, plays a fanfare + speaks the name, and "Play Again" rotates to
// the next Pokémon in a shuffled pool. Positive feedback only — a missed
// drop just springs back to the tray, no sound, no "wrong" anything.
// ---------------------------------------------------------------------------

import { ARTWORK, SPRITE_FALLBACK, onSpriteError } from "@/lib/sprites";
import { playTap, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { pokedex } from "@/content/pokedex";
import { useSession } from "@/context/SessionContext";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";

const SPRITE = ARTWORK;

// Kid-friendly Gen-1-heavy pool (same list style as match.tsx / dots.tsx).
const POOL_IDS = [25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 52, 54, 129, 35, 94, 175];

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

// ---------------------------------------------------------------------------
// Piece geometry
// ---------------------------------------------------------------------------

interface PieceDef {
  id: number; // 0-based, row-major
  col: number;
  row: number;
}

function buildPieces(cols: number, rows: number): PieceDef[] {
  const pieces: PieceDef[] = [];
  let id = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pieces.push({ id: id++, col, row });
    }
  }
  return pieces;
}

// Percentage-based CSS sprite-sheet slicing — works at any render size
// because backgroundSize/backgroundPosition are relative to the element's
// own box, so a tray thumbnail and a full board cell show the same crop.
function pieceBgStyle(
  imageUrl: string,
  col: number,
  row: number,
  cols: number,
  rows: number,
): React.CSSProperties {
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 50}% ${
      rows > 1 ? (row / (rows - 1)) * 100 : 50
    }%`,
    backgroundRepeat: "no-repeat",
  };
}

const SNAP_FRACTION = 0.65; // generous — fraction of a cell's larger side
const TRAY_SIZE = 128; // fixed square tray-thumbnail px, always ≥88px

// ---------------------------------------------------------------------------
// Tray piece — draggable, snaps home via framer-motion's built-in
// dragSnapToOrigin when it misses the board (no manual reset needed).
// ---------------------------------------------------------------------------

interface TrayPieceProps {
  piece: PieceDef;
  imageUrl: string;
  cols: number;
  rows: number;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: (info: PanInfo) => void;
}

function TrayPiece({
  piece,
  imageUrl,
  cols,
  rows,
  isDragging,
  onDragStart,
  onDragEnd,
}: TrayPieceProps) {
  return (
    <motion.div
      drag
      dragSnapToOrigin
      dragElastic={0.15}
      dragMomentum={false}
      whileDrag={{ scale: 1.1 }}
      onDragStart={() => onDragStart()}
      onDragEnd={(_e, info) => onDragEnd(info)}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      style={{
        width: TRAY_SIZE,
        height: TRAY_SIZE,
        touchAction: "none",
        zIndex: isDragging ? 50 : 1,
        ...pieceBgStyle(imageUrl, piece.col, piece.row, cols, rows),
      }}
      className="relative shrink-0 rounded-2xl shadow-md border-2 border-white cursor-grab active:cursor-grabbing"
      aria-label={`Puzzle piece ${piece.id + 1}`}
    >
      <span className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-white text-gray-700 text-sm font-black flex items-center justify-center shadow select-none pointer-events-none">
        {piece.id + 1}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PuzzlePage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;

  // 5yo-only difficulty toggle: 3x2 (6 pieces) or 3x3 (9 pieces).
  const [wantNine, setWantNine] = useState(false);
  const cols = 3;
  const rows = is3yo ? 2 : wantNine ? 3 : 2;
  const gridCols = is3yo ? 2 : cols;
  const pieceCount = gridCols * rows;

  // Rotate through a shuffled pool so "Play Again" never repeats immediately.
  const [pool, setPool] = useState<number[]>(() => shuffle(POOL_IDS));
  const [poolIdx, setPoolIdx] = useState(0);
  const pokemonId = pool[poolIdx % pool.length];
  const name = pokeName(pokemonId);

  // Defensive fallback: if the bundled artwork ever fails to load, slice the
  // bundled neutral SVG instead of showing blank tiles (offline-first).
  const [artworkOk, setArtworkOk] = useState(true);
  useEffect(() => {
    setArtworkOk(true);
    const img = new Image();
    img.onload = () => setArtworkOk(true);
    img.onerror = () => setArtworkOk(false);
    img.src = SPRITE(pokemonId);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [pokemonId]);
  const imageUrl = artworkOk ? SPRITE(pokemonId) : SPRITE_FALLBACK;

  const pieces = useMemo(() => buildPieces(gridCols, rows), [gridCols, rows]);
  const [trayOrder, setTrayOrder] = useState<number[]>(() =>
    shuffle(pieces.map((p) => p.id)),
  );
  const [placed, setPlaced] = useState<Set<number>>(new Set());
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Fresh puzzle whenever the active Pokémon or the grid size changes.
  useEffect(() => {
    setTrayOrder(shuffle(pieces.map((p) => p.id)));
    setPlaced(new Set());
    setDraggingId(null);
    setDone(false);
  }, [pokemonId, pieces]);

  // Prefetch every pool Pokémon's name once on mount.
  useEffect(() => {
    void prefetch(POOL_IDS.map((id) => ({ text: spokenName(pokeName(id)), lang: "en" as const })));
    return () => stopSpeaking();
  }, []);

  const placePiece = useCallback((pieceId: number) => {
    playTap();
    setPlaced((prev) => {
      const next = new Set(prev);
      next.add(pieceId);
      return next;
    });
    setTrayOrder((prev) => prev.filter((id) => id !== pieceId));
  }, []);

  const handleDragEnd = useCallback(
    (piece: PieceDef, info: PanInfo) => {
      setDraggingId(null);
      const el = boardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const pieceW = rect.width / gridCols;
      const pieceH = rect.height / rows;
      const dropX = info.point.x - rect.left;
      const dropY = info.point.y - rect.top;
      const targetCx = (piece.col + 0.5) * pieceW;
      const targetCy = (piece.row + 0.5) * pieceH;
      const dist = Math.hypot(dropX - targetCx, dropY - targetCy);
      const snapRadius = Math.max(pieceW, pieceH) * SNAP_FRACTION;
      if (dist <= snapRadius) {
        placePiece(piece.id);
      }
    },
    [gridCols, rows, placePiece],
  );

  // Completion — small delay so the last piece's pop-in lands before the
  // celebration takes over (same pattern as match.tsx).
  useEffect(() => {
    if (pieceCount > 0 && placed.size === pieceCount && !done) {
      const t = setTimeout(() => {
        playFanfare();
        playJingle();
        void speakText(`It's ${spokenName(name)}!`, "en");
        void logAttempt("puzzle", `puzzle-${pokemonId}-${pieceCount}pcs`, true);
        setDone(true);
      }, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [placed, pieceCount, done, pokemonId, name, logAttempt]);

  const playAgain = useCallback(() => {
    playTap();
    stopSpeaking();
    stopMusic(); // route doesn't change, so App's music-stop effect never re-runs

    const next = poolIdx + 1;
    if (next >= pool.length) {
      setPool(shuffle(POOL_IDS));
      setPoolIdx(0);
    } else {
      setPoolIdx(next);
    }

    // Reset round state explicitly instead of relying solely on the
    // [pokemonId, pieces] effect: if the reshuffled pool's first id ever
    // matches the Pokémon just completed, pokemonId/pieces stay unchanged,
    // that effect never fires, and `done` would stay stuck true — freezing
    // the celebration screen.
    setTrayOrder(shuffle(pieces.map((p) => p.id)));
    setPlaced(new Set());
    setDraggingId(null);
    setDone(false);
  }, [pool, poolIdx, pieces]);

  const selectSix = useCallback(() => {
    if (!wantNine) return;
    playTap();
    setWantNine(false);
  }, [wantNine]);

  const selectNine = useCallback(() => {
    if (wantNine) return;
    playTap();
    setWantNine(true);
  }, [wantNine]);

  const placedPieces = pieces.filter((p) => placed.has(p.id));

  // -------------------------------------------------------------------------
  // Completion screen
  // -------------------------------------------------------------------------
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src={SPRITE(pokemonId)}
            onError={onSpriteError}
            alt={name}
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />

          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">
            You found them all!
          </h2>
          <p className="text-3xl font-bold text-gray-600">It's {name}!</p>

          {/* One star per piece, all filled — positive only */}
          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {Array.from({ length: pieceCount }).map((_, i) => (
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
              onClick={playAgain}
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

  // -------------------------------------------------------------------------
  // Game screen
  // -------------------------------------------------------------------------
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
          <h1 className="text-3xl font-black text-pokemon-blue leading-tight">Puzzles</h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            {placed.size} / {pieceCount} pieces placed
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
            <motion.div
              className="bg-pokemon-blue h-3 rounded-full"
              animate={{ width: `${(placed.size / pieceCount) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {!is3yo && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={selectSix}
              className="min-h-[88px] min-w-[110px] rounded-2xl font-black text-lg px-4 transition-colors"
              style={{
                background: !wantNine ? "#dbeafe" : "#f3f4f6",
                border: !wantNine ? "3px solid #3b4cca" : "3px solid transparent",
                color: !wantNine ? "#3b4cca" : "#4b5563",
              }}
            >
              6 Pieces
            </button>
            <button
              onClick={selectNine}
              className="min-h-[88px] min-w-[110px] rounded-2xl font-black text-lg px-4 transition-colors"
              style={{
                background: wantNine ? "#dbeafe" : "#f3f4f6",
                border: wantNine ? "3px solid #3b4cca" : "3px solid transparent",
                color: wantNine ? "#3b4cca" : "#4b5563",
              }}
            >
              9 Pieces
            </button>
          </div>
        )}
      </div>

      {/* Play area: board + tray */}
      <div className="flex-1 flex justify-center gap-6 min-h-0 items-stretch">
        {/* Board */}
        <div className="flex items-center justify-center min-w-0">
          <div
            ref={boardRef}
            className="relative bg-white rounded-3xl shadow-xl border-4 border-gray-100 overflow-hidden"
            style={{
              width: `min(52vw, calc(64vh * ${gridCols} / ${rows}))`,
              aspectRatio: `${gridCols} / ${rows}`,
            }}
          >
            {/* Faded guide artwork — stretched to fill the board, matching
                the same stretch mapping the sliced pieces use below. */}
            <img
              src={imageUrl}
              onError={onSpriteError}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-fill opacity-[0.15] grayscale pointer-events-none select-none"
              draggable={false}
            />

            {/* Empty slot outlines with a friendly number hint */}
            {pieces
              .filter((p) => !placed.has(p.id))
              .map((p) => (
                <div
                  key={`slot-${p.id}`}
                  className="absolute flex items-center justify-center border border-white/60 pointer-events-none select-none"
                  style={{
                    left: `${(p.col / gridCols) * 100}%`,
                    top: `${(p.row / rows) * 100}%`,
                    width: `${100 / gridCols}%`,
                    height: `${100 / rows}%`,
                  }}
                >
                  <span
                    className="text-white/80 font-black"
                    style={{ fontSize: "min(6vw, 42px)", textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
                  >
                    {p.id + 1}
                  </span>
                </div>
              ))}

            {/* Locked, correctly-placed pieces */}
            <AnimatePresence>
              {placedPieces.map((p) => (
                <motion.div
                  key={`placed-${p.id}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="absolute"
                  style={{
                    left: `${(p.col / gridCols) * 100}%`,
                    top: `${(p.row / rows) * 100}%`,
                    width: `${100 / gridCols}%`,
                    height: `${100 / rows}%`,
                    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.55)",
                    ...pieceBgStyle(imageUrl, p.col, p.row, gridCols, rows),
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Tray */}
        <div
          className="shrink-0 bg-white/70 rounded-3xl shadow-inner border-4 border-white p-3 flex flex-wrap content-start gap-3"
          style={{
            width: 300,
            maxHeight: "70vh",
            // `overflow-y-auto` alone makes overflow-x compute to `auto` too
            // (CSS overflow spec), which clips a framer-motion drag's
            // transform the instant it crosses the tray's left edge — the
            // board sits to the left, so the piece would vanish mid-drag.
            // Only clip for tray scrolling when nothing is being dragged.
            overflow: draggingId !== null ? "visible" : "auto",
          }}
        >
          <AnimatePresence>
            {trayOrder.map((id) => {
              const piece = pieces.find((p) => p.id === id);
              if (!piece) return null;
              return (
                <TrayPiece
                  key={id}
                  piece={piece}
                  imageUrl={imageUrl}
                  cols={gridCols}
                  rows={rows}
                  isDragging={draggingId === id}
                  onDragStart={() => {
                    playTap();
                    setDraggingId(id);
                  }}
                  onDragEnd={(info) => handleDragEnd(piece, info)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
