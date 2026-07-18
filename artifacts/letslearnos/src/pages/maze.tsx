// ---------------------------------------------------------------------------
// maze.tsx — Maze module (route /maze)
//
// Deterministic seeded recursive-backtracker mazes (no Math.random anywhere
// in this file — every random choice, including maze shape AND which
// Pokémon appear, comes from a seeded PRNG so "maze N" is always the same
// shape). 3yo gets a 5x5 grid (wide corridors — fewer, bigger cells on the
// same board). 5yo gets 8x8.
//
// The child drags a finger from their partner Pokémon (start) through the
// corridors to the exit Pokémon. Hitting a wall just stops the drawn line
// right at the wall — no penalty, no sound, no "wrong" anything. Reaching
// the exit: fanfare, a few stars, the Pokémon's name spoken, and a
// "Next Maze" button. A session is 5 mazes, capped off with a full
// celebration screen (matches dots.tsx / match.tsx conventions).
// ---------------------------------------------------------------------------

import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { pokedex } from "@/content/pokedex";
import { useSession } from "@/context/SessionContext";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star, RotateCcw } from "lucide-react";

const SPRITE = ARTWORK;

// The kiosk never scrolls, so the page needs a definite height — the h-full
// chain collapses under App's min-h-screen wrapper (see match.tsx's note /
// geography.tsx's comment). 120px = TopBar (88) + App's pb-4 + breathing room.
const PAGE_HEIGHT = "calc(100vh - 200px)";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Pokémon ids used as the maze "exit" character. Gen-1-heavy, hand-picked
// (this module's own pool — there is no single shared pool in the app).
const POOL_IDS = [25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 54, 129, 35, 52, 113, 175];

// Session length — 5 mazes per visit, matching dots.tsx / match.tsx.
const SESSION_SIZE = 5;

// Fixed seed list — maze N (by session index) is always the same shape.
// Large-ish arbitrary primes; only their determinism matters.
const MAZE_SEEDS = [
  104729, 92821, 15485867, 32452843, 49979687,
  67867967, 86028121, 104395303, 122949829, 141650939,
];

// Seed used to pick + order this session's exit Pokémon — deterministic too,
// so no Math.random appears anywhere in this module.
const SESSION_SEED = 424242;

// Path colours per puzzle index (cycled), one hex per SVG stroke.
const PATH_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ec4899"];

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic, no Math.random anywhere below.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pokemonName(id: number): string {
  return pokedex.find((e) => e.id === id)?.name ?? `#${id}`;
}

// ---------------------------------------------------------------------------
// Maze generation — recursive backtracker, deterministic given (n, seed).
// Each cell tracks which of its 4 sides are OPEN passages (true = open).
// ---------------------------------------------------------------------------

interface MazeCell {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

function generateMaze(n: number, seed: number): MazeCell[] {
  const cells: MazeCell[] = Array.from({ length: n * n }, () => ({
    n: false,
    s: false,
    e: false,
    w: false,
  }));
  const visited = new Array(n * n).fill(false) as boolean[];
  const rand = mulberry32(seed);
  const idx = (r: number, c: number) => r * n + c;

  const stack: number[] = [0];
  visited[0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const r = Math.floor(current / n);
    const c = current % n;

    const options: Array<{
      dir: "n" | "s" | "e" | "w";
      opp: "n" | "s" | "e" | "w";
      to: number;
    }> = [];
    if (r > 0 && !visited[idx(r - 1, c)]) options.push({ dir: "n", opp: "s", to: idx(r - 1, c) });
    if (r < n - 1 && !visited[idx(r + 1, c)]) options.push({ dir: "s", opp: "n", to: idx(r + 1, c) });
    if (c < n - 1 && !visited[idx(r, c + 1)]) options.push({ dir: "e", opp: "w", to: idx(r, c + 1) });
    if (c > 0 && !visited[idx(r, c - 1)]) options.push({ dir: "w", opp: "e", to: idx(r, c - 1) });

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const pick = options[Math.floor(rand() * options.length)];
    cells[current][pick.dir] = true;
    cells[pick.to][pick.opp] = true;
    visited[pick.to] = true;
    stack.push(pick.to);
  }

  return cells;
}

function cellRC(index: number, n: number): { r: number; c: number } {
  return { r: Math.floor(index / n), c: index % n };
}

function cellCenterPx(index: number, n: number, cellSize: number): { x: number; y: number } {
  const { r, c } = cellRC(index, n);
  return { x: c * cellSize + cellSize / 2, y: r * cellSize + cellSize / 2 };
}

function connected(cells: MazeCell[], n: number, a: number, b: number): boolean {
  const { r: ra, c: ca } = cellRC(a, n);
  const { r: rb, c: cb } = cellRC(b, n);
  if (ra === rb && cb === ca + 1) return cells[a].e;
  if (ra === rb && cb === ca - 1) return cells[a].w;
  if (ca === cb && rb === ra + 1) return cells[a].s;
  if (ca === cb && rb === ra - 1) return cells[a].n;
  return false;
}

// Clamp a point to the bounding box of a single cell — used to draw the
// "reaching toward a wall" tail so it visually stops right at the wall.
function clampToCellBox(
  pt: { x: number; y: number },
  cellIndex: number,
  n: number,
  cellSize: number,
): { x: number; y: number } {
  const { r, c } = cellRC(cellIndex, n);
  const minX = c * cellSize;
  const maxX = minX + cellSize;
  const minY = r * cellSize;
  const maxY = minY + cellSize;
  return {
    x: Math.min(Math.max(pt.x, minX), maxX),
    y: Math.min(Math.max(pt.y, minY), maxY),
  };
}

// ---------------------------------------------------------------------------
// MazeBoard — a single maze puzzle
// ---------------------------------------------------------------------------

interface MazeBoardProps {
  gridN: number;
  seed: number;
  pokemonId: number; // exit Pokémon
  avatarId: number; // start / partner Pokémon
  puzzleIndex: number; // 0-based, for colour theming
  onComplete: () => void;
}

function MazeBoard({ gridN, seed, pokemonId, avatarId, puzzleIndex, onComplete }: MazeBoardProps) {
  const { logAttempt } = useSession();

  const cells = useMemo(() => generateMaze(gridN, seed), [gridN, seed]);
  const exitIndex = gridN * gridN - 1;
  const exitName = pokemonName(pokemonId);
  const themeColor = PATH_COLORS[puzzleIndex % PATH_COLORS.length];

  // Ordered list of cell indices the child has connected so far, starting
  // at the start cell (top-left, index 0).
  const [path, setPath] = useState<number[]>([0]);
  const [dragging, setDragging] = useState(false);
  const [liveCursor, setLiveCursor] = useState<{ x: number; y: number } | null>(null);
  const [solved, setSolved] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(0);

  // Measure the board's rendered CSS size (square) so we can convert
  // pointer coordinates and lay out cells/walls in the same space.
  useLayoutEffect(() => {
    function measure() {
      if (boardRef.current) {
        setBoardPx(boardRef.current.getBoundingClientRect().width);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const cellSize = boardPx > 0 ? boardPx / gridN : 0;
  const wallWidth = boardPx > 0 ? Math.max(6, cellSize * 0.12) : 0;
  const pathWidth = boardPx > 0 ? Math.max(14, cellSize * 0.34) : 0;

  // Convert a raw pointer event's client coordinates into the board's own
  // px coordinate space. getBoundingClientRect() already reports CSS px
  // post devicePixelRatio / OS-zoom scaling; we additionally scale by
  // boardPx/rect so the math stays correct even if the measured rect and
  // our cached boardPx state ever drift by a frame (e.g. mid-resize).
  const toLocal = useCallback(
    (clientX: number, clientY: number) => {
      const el = boardRef.current;
      if (!el || boardPx === 0) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const scaleX = rect.width > 0 ? boardPx / rect.width : 1;
      const scaleY = rect.height > 0 ? boardPx / rect.height : 1;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    },
    [boardPx],
  );

  // -------------------------------------------------------------------------
  // Pointer handlers
  // -------------------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (solved || boardPx === 0) return;
      const pt = toLocal(e.clientX, e.clientY);
      const lastCell = path[path.length - 1];
      const lastCenter = cellCenterPx(lastCell, gridN, cellSize);
      const dist = Math.hypot(pt.x - lastCenter.x, pt.y - lastCenter.y);
      // Only start a drag if the touch begins near wherever the path
      // currently ends (the start sprite on a fresh maze, or wherever the
      // child last lifted their finger) — keeps stray taps harmless.
      if (dist > cellSize * 0.9) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      setLiveCursor(pt);
    },
    [solved, boardPx, cellSize, gridN, path, toLocal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || solved || boardPx === 0) return;
      const pt = toLocal(e.clientX, e.clientY);
      const col = Math.min(gridN - 1, Math.max(0, Math.floor(pt.x / cellSize)));
      const row = Math.min(gridN - 1, Math.max(0, Math.floor(pt.y / cellSize)));
      const candidate = row * gridN + col;
      const lastCell = path[path.length - 1];

      if (candidate === lastCell) {
        setLiveCursor(pt);
        return;
      }

      // Sliding back over the previous dot shortens the path — friendly
      // "undo by dragging back" rather than a hard stop.
      if (path.length >= 2 && candidate === path[path.length - 2]) {
        setPath((p) => p.slice(0, -1));
        setLiveCursor(pt);
        return;
      }

      const { r: lr, c: lc } = cellRC(lastCell, gridN);
      const { r: cr, c: cc } = cellRC(candidate, gridN);
      const isOrthogonalNeighbor = Math.abs(lr - cr) + Math.abs(lc - cc) === 1;

      if (isOrthogonalNeighbor && connected(cells, gridN, lastCell, candidate) && !path.includes(candidate)) {
        playTap();
        const nextPath = [...path, candidate];
        setPath(nextPath);
        setLiveCursor(cellCenterPx(candidate, gridN, cellSize));

        if (candidate === exitIndex) {
          setDragging(false);
          setSolved(true);
          setLiveCursor(null);
          playFanfare();
          void speakText(`You found ${spokenName(exitName)}!`, "en");
          void logAttempt("maze", `maze-${pokemonId}`, true);
        }
        return;
      }

      // Blocked by a wall (or not reachable) — clamp the visual tail to
      // the current cell's own box, so the line simply stops at the wall.
      // No sound, no penalty.
      setLiveCursor(clampToCellBox(pt, lastCell, gridN, cellSize));
    },
    [dragging, solved, boardPx, gridN, cellSize, path, cells, exitIndex, exitName, pokemonId, logAttempt, toLocal],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setLiveCursor(null);
  }, []);

  const handleRestart = useCallback(() => {
    playTap();
    setPath([0]);
    setDragging(false);
    setLiveCursor(null);
  }, []);

  // -------------------------------------------------------------------------
  // Derived geometry
  // -------------------------------------------------------------------------

  const wallSegments = useMemo(() => {
    if (boardPx === 0) return [] as Array<{ x1: number; y1: number; x2: number; y2: number }>;
    const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < cells.length; i++) {
      const { r, c } = cellRC(i, gridN);
      const x0 = c * cellSize;
      const y0 = r * cellSize;
      const x1 = x0 + cellSize;
      const y1 = y0 + cellSize;
      const cell = cells[i];
      if (!cell.n) segs.push({ x1: x0, y1: y0, x2: x1, y2: y0 });
      if (!cell.s) segs.push({ x1: x0, y1: y1, x2: x1, y2: y1 });
      if (!cell.w) segs.push({ x1: x0, y1: y0, x2: x0, y2: y1 });
      if (!cell.e) segs.push({ x1: x1, y1: y0, x2: x1, y2: y1 });
    }
    return segs;
  }, [cells, gridN, cellSize, boardPx]);

  const pathPoints = useMemo(() => {
    if (boardPx === 0) return [] as Array<{ x: number; y: number }>;
    return path.map((i) => cellCenterPx(i, gridN, cellSize));
  }, [path, gridN, cellSize, boardPx]);

  const startCenter = boardPx > 0 ? cellCenterPx(0, gridN, cellSize) : { x: 0, y: 0 };
  const exitCenter = boardPx > 0 ? cellCenterPx(exitIndex, gridN, cellSize) : { x: 0, y: 0 };
  const spriteSize = cellSize * 0.76;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col items-center flex-1 gap-4 w-full">
      <div
        ref={boardRef}
        className="relative bg-white rounded-3xl shadow-xl border-4 border-gray-100 overflow-hidden"
        style={{ width: "min(66vh, 60vw)", height: "min(66vh, 60vw)", touchAction: "none", flexShrink: 0 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {boardPx > 0 && (
          <>
            <svg width={boardPx} height={boardPx} className="absolute inset-0 pointer-events-none">
              {wallSegments.map((s, i) => (
                <line
                  key={i}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke="#4b5563"
                  strokeWidth={wallWidth}
                  strokeLinecap="round"
                />
              ))}
              {pathPoints.length > 1 && (
                <polyline
                  points={pathPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={themeColor}
                  strokeWidth={pathWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {liveCursor && pathPoints.length > 0 && (
                <line
                  x1={pathPoints[pathPoints.length - 1].x}
                  y1={pathPoints[pathPoints.length - 1].y}
                  x2={liveCursor.x}
                  y2={liveCursor.y}
                  stroke={themeColor}
                  strokeWidth={pathWidth}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              )}
            </svg>

            {/* Start sprite — the child's own partner Pokémon */}
            <img
              src={SPRITE(avatarId)}
              onError={onSpriteError}
              alt="Your Pokémon"
              draggable={false}
              className="absolute rounded-full bg-white shadow-lg border-4 border-white pointer-events-none object-contain z-10"
              style={{
                left: startCenter.x - spriteSize / 2,
                top: startCenter.y - spriteSize / 2,
                width: spriteSize,
                height: spriteSize,
              }}
            />

            {/* Exit sprite — today's maze goal */}
            <motion.img
              src={SPRITE(pokemonId)}
              onError={onSpriteError}
              alt={exitName}
              draggable={false}
              className="absolute rounded-full bg-white shadow-lg border-4 pointer-events-none object-contain z-10"
              animate={solved ? { scale: 1 } : { scale: [1, 1.08, 1] }}
              transition={solved ? {} : { repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              style={{
                left: exitCenter.x - spriteSize / 2,
                top: exitCenter.y - spriteSize / 2,
                width: spriteSize,
                height: spriteSize,
                borderColor: themeColor,
              }}
            />
          </>
        )}
      </div>

      {/* Hint + Restart, while the maze is still in progress */}
      {!solved && (
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <p className="text-xl font-bold text-gray-500">Find the way to {exitName}!</p>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleRestart}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 font-black px-6 rounded-2xl shadow min-h-[88px] min-w-[88px]"
            aria-label="Restart maze"
          >
            <RotateCcw size={28} />
            Restart
          </motion.button>
        </div>
      )}

      {/* Post-solve celebration + Next Maze */}
      <AnimatePresence>
        {solved && (
          <motion.div
            key="solved"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
                >
                  <Star size={44} className="text-pokemon-yellow fill-pokemon-yellow drop-shadow" />
                </motion.div>
              ))}
            </div>
            <p className="text-4xl font-black text-pokemon-blue drop-shadow text-center">
              You found {exitName}!
            </p>
            <button
              onClick={onComplete}
              className="bg-pokemon-blue text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-lg min-h-[88px] min-w-[220px] active:scale-95 transition-transform"
            >
              Next Maze →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MazePage (exported default)
// ---------------------------------------------------------------------------

export default function MazePage() {
  const { profile } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;
  const gridN = is3yo ? 5 : 8;
  const avatarId = profile?.avatarPokemonId ?? 25;

  // Deterministic session line-up (seeded — no Math.random anywhere here).
  const [puzzleIds] = useState<number[]>(() =>
    seededShuffle(POOL_IDS, SESSION_SEED).slice(0, SESSION_SIZE),
  );

  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [done, setDone] = useState(false);

  // Prefetch TTS for every "You found X!" line this session might speak.
  useEffect(() => {
    const phrases = puzzleIds.map((id) => ({
      text: `You found ${spokenName(pokemonName(id))}!`,
      lang: "en" as const,
    }));
    void prefetch(phrases);
    return () => stopSpeaking();
  }, [puzzleIds]);

  const handlePuzzleComplete = useCallback(() => {
    if (puzzleIdx + 1 >= SESSION_SIZE) {
      stopSpeaking();
      playFanfare();
      playJingle();
      setDone(true);
    } else {
      setPuzzleIdx((i) => i + 1);
    }
  }, [puzzleIdx]);

  const handlePlayAgain = useCallback(() => {
    playTap();
    stopSpeaking();
    stopMusic();
    setPuzzleIdx(0);
    setDone(false);
  }, []);

  // -------------------------------------------------------------------------
  // Session-complete screen
  // -------------------------------------------------------------------------
  if (done) {
    return (
      <div
        className="flex flex-col items-center justify-center px-6 text-center gap-6"
        style={{ height: PAGE_HEIGHT }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src={SPRITE(avatarId)}
            onError={onSpriteError}
            alt="Your Pokémon"
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            draggable={false}
          />
          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">
            You solved every maze!
          </h2>
          <p className="text-3xl font-bold text-gray-600">
            You found all {SESSION_SIZE} Pokémon friends!
          </p>
          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {Array.from({ length: SESSION_SIZE }).map((_, i) => (
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
              onClick={handlePlayAgain}
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
  // Active maze screen
  // -------------------------------------------------------------------------
  const currentSeed = MAZE_SEEDS[puzzleIdx % MAZE_SEEDS.length];
  const currentPokemonId = puzzleIds[puzzleIdx];

  return (
    <div
      className="flex flex-col px-4 py-4 gap-3"
      style={{ height: PAGE_HEIGHT }}
    >
      {/* Header row */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/home")}
          aria-label="Back to Home"
          className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200"
        >
          <ArrowLeft size={44} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black text-pokemon-blue leading-tight">Maze</h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            Maze {puzzleIdx + 1} of {SESSION_SIZE}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
            <motion.div
              className="bg-pokemon-blue h-3 rounded-full"
              animate={{ width: `${((puzzleIdx + 1) / SESSION_SIZE) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Play area — maze remounts fully per puzzle (fresh path/board state) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={puzzleIdx}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.25 }}
          className="flex-1 flex flex-col items-center justify-center min-h-0"
        >
          <MazeBoard
            gridN={gridN}
            seed={currentSeed}
            pokemonId={currentPokemonId}
            avatarId={avatarId}
            puzzleIndex={puzzleIdx}
            onComplete={handlePuzzleComplete}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
