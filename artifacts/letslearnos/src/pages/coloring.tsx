import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playFanfare } from "@/lib/sound";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Undo2, Trash2, Eraser } from "lucide-react";
import { useSession } from "@/context/SessionContext";

const SPRITE = ARTWORK;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const POKEMON_LIST = [
  { id: 25, name: "Pikachu" },
  { id: 1, name: "Bulbasaur" },
  { id: 4, name: "Charmander" },
  { id: 7, name: "Squirtle" },
  { id: 133, name: "Eevee" },
  { id: 39, name: "Jigglypuff" },
  { id: 52, name: "Meowth" },
  { id: 143, name: "Snorlax" },
  { id: 6, name: "Charizard" },
  { id: 131, name: "Lapras" },
  { id: 151, name: "Mew" },
  { id: 94, name: "Gengar" },
] as const;

const PALETTE = [
  { color: "#ef4444", name: "Red" },
  { color: "#f97316", name: "Orange" },
  { color: "#facc15", name: "Yellow" },
  { color: "#22c55e", name: "Green" },
  { color: "#3b82f6", name: "Blue" },
  { color: "#a855f7", name: "Purple" },
  { color: "#ec4899", name: "Pink" },
  { color: "#a16207", name: "Brown" },
  { color: "#1f2937", name: "Black" },
  { color: "#ffffff", name: "White" },
] as const;

const BRUSH_SIZES = [
  { label: "S", size: 8, dotPx: 8 },
  { label: "M", size: 22, dotPx: 16 },
  { label: "L", size: 48, dotPx: 24 },
] as const;

// ---------------------------------------------------------------------------
// Stroke types
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  color: string;
  size: number;
  erase: boolean;
  points: Point[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redrawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h);
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.erase
      ? "destination-out"
      : "source-over";
    // A one-point stroke (pure tap) strokes to nothing — replay it as the
    // filled dot that pointer-down originally drew.
    if (stroke.points.length === 1) {
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(
        stroke.points[0].x,
        stroke.points[0].y,
        stroke.size / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Sub-component: Canvas drawing area
// ---------------------------------------------------------------------------

interface DrawingCanvasProps {
  pokemonId: number;
  pokemonName: string;
  activeColor: string;
  brushSize: number;
  erasing: boolean;
  strokes: Stroke[];
  onStrokesChange: (s: Stroke[]) => void;
}

function DrawingCanvas({
  pokemonId,
  pokemonName,
  activeColor,
  brushSize,
  erasing,
  strokes,
  onStrokesChange,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  // Keep a fresh ref so pointer-event callbacks can read the latest strokes
  // without stale-closure issues.
  const strokesRef = useRef<Stroke[]>(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Size the backing store once the container is laid out.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const side = Math.min(rect.width, rect.height);
    canvas.width = side * dpr;
    canvas.height = side * dpr;
    canvas.style.width = `${side}px`;
    canvas.style.height = `${side}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    redrawStrokes(ctx, strokesRef.current, side, side);
  }, []);

  // Redraw whenever strokes change (undo / clear).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const side = canvas.width / dpr;
    redrawStrokes(ctx, strokes, side, side);
  }, [strokes]);

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      const pt = toCanvasPoint(e.clientX, e.clientY);
      const stroke: Stroke = {
        color: activeColor,
        size: brushSize,
        erase: erasing,
        points: [pt],
      };
      currentStrokeRef.current = stroke;

      // Draw a dot immediately so tap-without-move leaves a mark.
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = erasing
        ? "destination-out"
        : "source-over";
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [activeColor, brushSize, erasing, toCanvasPoint],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || !currentStrokeRef.current) return;
      const pt = toCanvasPoint(e.clientX, e.clientY);
      currentStrokeRef.current.points.push(pt);

      // Incremental draw for the current stroke.
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pts = currentStrokeRef.current.points;
      const prev = pts[pts.length - 2];
      ctx.save();
      ctx.globalCompositeOperation = erasing
        ? "destination-out"
        : "source-over";
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();
    },
    [activeColor, brushSize, erasing, toCanvasPoint],
  );

  const onPointerUp = useCallback(() => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    onStrokesChange([...strokesRef.current, finished]);
  }, [onStrokesChange]);

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ touchAction: "none" }}
    >
      {/* Shared square box keeps the guide image and the paint canvas
          perfectly aligned — the drawing area itself is wide. */}
      <div ref={containerRef} className="relative h-full aspect-square max-w-full">
        {/* Guide image — grayscale, faint */}
        <img
          src={SPRITE(pokemonId)}
          onError={onSpriteError}
          alt={pokemonName}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ filter: "grayscale(100%) opacity(0.22)" }}
          draggable={false}
        />
        {/* Painting canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Phase = "picker" | "canvas" | "done";

export default function ColoringPage() {
  const { logAttempt } = useSession();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("picker");
  const [selectedPokemon, setSelectedPokemon] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [activeColor, setActiveColor] = useState<string>(PALETTE[0].color);
  const [brushSizeIndex, setBrushSizeIndex] = useState(1); // medium default
  const [erasing, setErasing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  // Warm TTS cache for all color names on mount.
  useEffect(() => {
    void prefetch(PALETTE.map((p) => ({ text: p.name, lang: "en" as const })));
    return () => stopSpeaking();
  }, []);

  // ---------------------------------------------------------------------------
  // Picker
  // ---------------------------------------------------------------------------

  const handlePickPokemon = useCallback(
    (poke: { id: number; name: string }) => {
      playTap();
      setSelectedPokemon(poke);
      setStrokes([]);
      setErasing(false);
      setPhase("canvas");
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Canvas controls
  // ---------------------------------------------------------------------------

  const handleColorSelect = useCallback((color: string, name: string) => {
    playTap();
    setActiveColor(color);
    setErasing(false);
    void speakText(name, "en");
  }, []);

  const handleBrushSelect = useCallback((idx: number) => {
    playTap();
    setBrushSizeIndex(idx);
  }, []);

  const handleEraserToggle = useCallback(() => {
    playTap();
    setErasing((e) => !e);
  }, []);

  const handleUndo = useCallback(() => {
    playTap();
    setStrokes((s) => s.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    playTap();
    setStrokes([]);
  }, []);

  const handleDone = useCallback(async () => {
    if (!selectedPokemon) return;
    playFanfare();
    await logAttempt("coloring", `color-${selectedPokemon.id}`, true);
    setPhase("done");
  }, [selectedPokemon, logAttempt]);

  const handleColorAnother = useCallback(() => {
    playTap();
    setStrokes([]);
    setPhase("picker");
  }, []);

  // ---------------------------------------------------------------------------
  // Render: Picker
  // ---------------------------------------------------------------------------

  if (phase === "picker") {
    return (
      <div className="flex flex-col h-full px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={() => navigate("/home")}
            className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft size={44} />
          </button>
          <h1 className="text-4xl font-black text-pokemon-blue">
            Pick a Pokémon to Color!
          </h1>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-6 gap-4 flex-1 overflow-auto pb-2">
          {POKEMON_LIST.map((poke) => (
            <motion.button
              key={poke.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => handlePickPokemon(poke)}
              className="bg-white rounded-3xl shadow-md flex flex-col items-center justify-center gap-2 p-3 min-h-[160px] border-4 border-transparent hover:border-pokemon-blue transition-colors"
            >
              <img
                src={SPRITE(poke.id)}
                onError={onSpriteError}
                alt={poke.name}
                className="w-24 h-24 object-contain"
                draggable={false}
              />
              <span className="text-xl font-black text-gray-800 text-center leading-tight">
                {poke.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Done / celebration
  // ---------------------------------------------------------------------------

  if (phase === "done" && selectedPokemon) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center relative overflow-hidden">
        {/* Star confetti */}
        <AnimatePresence>
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -40, x: (i - 7) * 60 }}
              animate={{
                opacity: [0, 1, 0],
                y: ["-10%", "110%"],
                rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
              }}
              transition={{
                duration: 2.2,
                delay: i * 0.1,
                ease: "easeIn",
              }}
              className="absolute text-5xl pointer-events-none select-none"
              style={{ left: `${(i / 13) * 90 + 5}%`, top: 0 }}
            >
              ★
            </motion.div>
          ))}
        </AnimatePresence>

        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className="flex flex-col items-center gap-6 z-10"
        >
          <img
            src={SPRITE(selectedPokemon.id)}
            onError={onSpriteError}
            alt={selectedPokemon.name}
            className="w-52 h-52 drop-shadow-2xl"
            draggable={false}
          />
          <h2 className="text-6xl font-black text-pokemon-blue drop-shadow">
            Amazing job!
          </h2>
          <p className="text-3xl font-bold text-gray-700">
            You colored {selectedPokemon.name}!
          </p>
          <div className="flex gap-6 mt-2">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={handleColorAnother}
              className="bg-pokemon-blue text-white text-2xl font-black px-10 py-6 rounded-3xl shadow-xl min-h-[88px]"
            >
              Color Another!
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => navigate("/home")}
              className="bg-gray-200 text-gray-800 text-2xl font-black px-10 py-6 rounded-3xl shadow-xl min-h-[88px]"
            >
              Back to Home
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Canvas phase
  // ---------------------------------------------------------------------------

  if (!selectedPokemon) return null;

  const activeBrushSize = BRUSH_SIZES[brushSizeIndex].size;

  return (
    <div className="flex h-full px-3 py-3 gap-3 overflow-hidden">
      {/* Left column: back + canvas */}
      <div className="flex flex-col flex-1 min-w-0 gap-3">
        {/* Top bar */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setPhase("picker")}
            className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Back to picker"
          >
            <ArrowLeft size={36} />
          </button>
          <img
            src={SPRITE(selectedPokemon.id)}
            onError={onSpriteError}
            alt={selectedPokemon.name}
            className="w-20 h-20 object-contain shrink-0"
            draggable={false}
          />
          <h2 className="text-3xl font-black text-pokemon-blue truncate">
            {selectedPokemon.name}
          </h2>

          {/* Undo / Clear */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-1 disabled:opacity-40"
              aria-label="Undo"
            >
              <Undo2 size={32} />
              <span className="text-xs font-bold">Undo</span>
            </button>
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-1 disabled:opacity-40"
              aria-label="Clear"
            >
              <Trash2 size={32} />
              <span className="text-xs font-bold">Clear</span>
            </button>
          </div>
        </div>

        {/* Drawing area */}
        <div
          className="flex-1 bg-white rounded-3xl shadow-inner border-4 border-gray-200 overflow-hidden relative"
          style={{ minHeight: 0 }}
        >
          <DrawingCanvas
            pokemonId={selectedPokemon.id}
            pokemonName={selectedPokemon.name}
            activeColor={activeColor}
            brushSize={activeBrushSize}
            erasing={erasing}
            strokes={strokes}
            onStrokesChange={setStrokes}
          />
        </div>

        {/* Done button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleDone}
          className="shrink-0 bg-pokemon-blue text-white text-3xl font-black py-5 rounded-3xl shadow-lg min-h-[88px]"
        >
          I'm Done! ✓
        </motion.button>
      </div>

      {/* Right column: palette + tools */}
      <div className="flex flex-col gap-3 shrink-0 w-[120px] overflow-y-auto">
        {/* Color swatches */}
        <div className="bg-white rounded-3xl shadow p-2 flex flex-col gap-2">
          {PALETTE.map((p) => (
            <motion.button
              key={p.color}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleColorSelect(p.color, p.name)}
              className="w-full rounded-2xl transition-all"
              style={{
                backgroundColor: p.color,
                minHeight: "88px",
                border:
                  activeColor === p.color && !erasing
                    ? "5px solid #3b82f6"
                    : p.color === "#ffffff"
                      ? "3px solid #d1d5db"
                      : "3px solid transparent",
                boxShadow:
                  activeColor === p.color && !erasing
                    ? "0 0 0 3px white, 0 0 0 6px #3b82f6"
                    : undefined,
              }}
              aria-label={p.name}
              title={p.name}
            />
          ))}
        </div>

        {/* Brush sizes */}
        <div className="bg-white rounded-3xl shadow p-2 flex flex-col gap-2 items-center">
          <span className="text-sm font-black text-gray-500 uppercase tracking-wide">
            Size
          </span>
          {BRUSH_SIZES.map((b, idx) => (
            <motion.button
              key={b.label}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleBrushSelect(idx)}
              className="w-full rounded-2xl flex items-center justify-center transition-all"
              style={{
                minHeight: "88px",
                background: brushSizeIndex === idx ? "#dbeafe" : "#f3f4f6",
                border:
                  brushSizeIndex === idx
                    ? "3px solid #3b82f6"
                    : "3px solid transparent",
              }}
              aria-label={`Brush size ${b.label}`}
            >
              <div
                className="rounded-full bg-gray-700"
                style={{ width: b.dotPx, height: b.dotPx }}
              />
            </motion.button>
          ))}
        </div>

        {/* Eraser */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleEraserToggle}
          className="rounded-3xl shadow flex flex-col items-center justify-center gap-1 transition-all"
          style={{
            minHeight: "100px",
            background: erasing ? "#fef3c7" : "#f3f4f6",
            border: erasing ? "3px solid #f59e0b" : "3px solid transparent",
          }}
          aria-label="Eraser"
        >
          <Eraser size={36} />
          <span className="text-sm font-black text-gray-600">Erase</span>
        </motion.button>
      </div>
    </div>
  );
}
