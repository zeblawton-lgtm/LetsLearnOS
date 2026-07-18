// ---------------------------------------------------------------------------
// Finger-tracing module — letters, numbers, and shapes.
// Route: /tracing
// ---------------------------------------------------------------------------
import { playCorrect, playTap } from "@/lib/sound";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { extractOutlinePoints } from "@/lib/contour";
import { pokedex } from "@/content/pokedex";
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, RotateCcw, Volume2, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

type Category = "ABC" | "123" | "Shapes" | "Pokemon";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBERS = "0123456789".split("");
const SHAPE_NAMES = ["Circle", "Square", "Triangle", "Star", "Heart"] as const;
type ShapeName = (typeof SHAPE_NAMES)[number];

// A kid-friendly, offline-bundled selection — same pool used by /dots so the
// artwork + names are already familiar and guaranteed to have sprites.
const POKEMON_POOL = [
  25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 54, 129, 35, 52, 113, 175,
];

const TAB_LABELS: Record<Category, string> = {
  ABC: "ABC",
  "123": "123",
  Shapes: "Shapes",
  Pokemon: "Pokémon",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pokemonIdFromItem(item: string): number {
  return Number(item.slice("pokemon-".length)) || 0;
}

function pokemonNameFor(item: string): string {
  const id = pokemonIdFromItem(item);
  return pokedex.find((e) => e.id === id)?.name ?? "Pokémon";
}

/** Text shown on screen — unlike utteranceFor, never sent for narration. */
function displayLabelFor(cat: Category, item: string): string {
  return cat === "Pokemon" ? pokemonNameFor(item) : item;
}

function utteranceFor(cat: Category, item: string): string {
  if (cat === "ABC") return `Letter ${item}!`;
  if (cat === "123") return `Number ${item}!`;
  if (cat === "Pokemon") return `It's ${spokenName(pokemonNameFor(item))}!`;
  return `${item}!`;
}

function questionIdFor(cat: Category, item: string): string {
  if (cat === "ABC") return `abc-${item}`;
  if (cat === "123") return `123-${item}`;
  if (cat === "Pokemon") return item; // already "pokemon-{id}"
  return `shape-${item.toLowerCase()}`;
}

function itemsFor(cat: Category): string[] {
  if (cat === "ABC") return LETTERS;
  if (cat === "123") return NUMBERS;
  if (cat === "Pokemon") return shuffle(POKEMON_POOL).map((id) => `pokemon-${id}`);
  return [...SHAPE_NAMES];
}

// ---------------------------------------------------------------------------
// Canvas guide drawing
// ---------------------------------------------------------------------------

const GUIDE_COLOR = "#e5e7eb"; // pale gray
const GUIDE_FILL = "#d1d5db";
const START_DOT_COLOR = "#22c55e"; // green-500

/** Draw the glyph (letter/number) guide onto a canvas. */
function drawLetterGuide(
  canvas: HTMLCanvasElement,
  glyph: string,
  dpr: number,
) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const fontSize = Math.round(h * 0.76);
  ctx.font = `900 ${fontSize}px system-ui, "Arial Black", sans-serif`;
  ctx.fillStyle = GUIDE_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, w / 2, h / 2 + fontSize * 0.04);

  // Green start-dot — top-left region of the glyph
  const metrics = ctx.measureText(glyph);
  const glyphLeft =
    w / 2 - (metrics.actualBoundingBoxLeft ?? metrics.width / 2);
  const glyphTop =
    h / 2 -
    (metrics.actualBoundingBoxAscent ?? fontSize / 2) +
    fontSize * 0.04;
  const dotR = Math.max(14, w * 0.025);
  ctx.beginPath();
  ctx.arc(glyphLeft + dotR * 1.4, glyphTop + dotR * 1.4, dotR, 0, Math.PI * 2);
  ctx.fillStyle = START_DOT_COLOR;
  ctx.fill();

  ctx.restore();
}

/** Draw a shape guide onto a canvas. */
function drawShapeGuide(
  canvas: HTMLCanvasElement,
  shape: ShapeName,
  dpr: number,
) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = GUIDE_FILL;
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 6;

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.38;

  ctx.beginPath();
  if (shape === "Circle") {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === "Square") {
    ctx.rect(cx - r, cy - r, r * 2, r * 2);
  } else if (shape === "Triangle") {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.97, cy + r * 0.82);
    ctx.lineTo(cx - r * 0.97, cy + r * 0.82);
    ctx.closePath();
  } else if (shape === "Star") {
    const spikes = 5;
    const outerR = r;
    const innerR = r * 0.42;
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const rr = i % 2 === 0 ? outerR : innerR;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === "Heart") {
    // Simple cubic-bezier heart centred at (cx, cy)
    const s = r * 0.95;
    ctx.moveTo(cx, cy + s * 0.72);
    ctx.bezierCurveTo(
      cx - s * 1.6,
      cy - s * 0.1,
      cx - s * 1.6,
      cy - s * 1.2,
      cx,
      cy - s * 0.5,
    );
    ctx.bezierCurveTo(
      cx + s * 1.6,
      cy - s * 1.2,
      cx + s * 1.6,
      cy - s * 0.1,
      cx,
      cy + s * 0.72,
    );
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // Start dot — top-centre-ish
  const dotR = Math.max(14, w * 0.025);
  let dotX = cx;
  let dotY = cy - r - dotR * 0.5;
  if (shape === "Triangle") dotY = cy - r + dotR * 0.5;
  if (shape === "Heart") dotY = cy - r * 0.35;

  ctx.beginPath();
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
  ctx.fillStyle = START_DOT_COLOR;
  ctx.fill();

  ctx.restore();
}

// Same inset fraction /dots.tsx uses for its watermark + dot overlay, so a
// Pokémon outline traced here lines up with that page's geometry too.
const POKEMON_MARGIN_FRAC = 0.08;

// Fallback outline (10-point star), used when extractOutlinePoints can't
// derive a real one (for example, missing artwork uses the neutral SVG,
// which has no alpha silhouette to trace).
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

/** Draw a Pokémon outline guide (faded stroke path) onto a canvas. */
function drawPokemonGuide(
  canvas: HTMLCanvasElement,
  points: Array<{ x: number; y: number }>,
  dpr: number,
) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx || points.length < 3) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const inner = w * (1 - 2 * POKEMON_MARGIN_FRAC);
  const toX = (nx: number) => w * POKEMON_MARGIN_FRAC + nx * inner;
  const toY = (ny: number) => h * POKEMON_MARGIN_FRAC + ny * inner;

  ctx.lineWidth = Math.max(16, w * 0.05);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = GUIDE_COLOR;

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = toX(p.x);
    const y = toY(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  // Green start-dot at the first outline point.
  const dotR = Math.max(14, w * 0.025);
  ctx.beginPath();
  ctx.arc(toX(points[0].x), toY(points[0].y), dotR, 0, Math.PI * 2);
  ctx.fillStyle = START_DOT_COLOR;
  ctx.fill();

  ctx.restore();
}

// Coverage ratio/threshold per category — a thin traced outline (Pokémon)
// needs a looser, wider-radius check than a filled glyph or shape.
function coverageParamsFor(cat: Category, is3yo: boolean) {
  if (cat === "Pokemon") {
    return { thresholdPx: 54, minRatio: is3yo ? 0.32 : 0.48 };
  }
  return { thresholdPx: 36, minRatio: is3yo ? 0.45 : 0.6 };
}

// ---------------------------------------------------------------------------
// Guide-point sampling (for coverage check)
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

function sampleGuidePoints(canvas: HTMLCanvasElement, gridPx: number): Point[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const { width, height } = canvas;
  // Guard against a blanked/zero-size canvas (e.g. mid-resize, or a GPU
  // context event elsewhere in the app touching the backing store) —
  // getImageData with a 0 dimension throws IndexSizeError.
  if (width === 0 || height === 0) return [];
  const data = ctx.getImageData(0, 0, width, height).data;
  const pts: Point[] = [];
  for (let py = 0; py < height; py += gridPx) {
    for (let px = 0; px < width; px += gridPx) {
      const i = (py * width + px) * 4;
      if (data[i + 3] > 30) {
        // ignore the pure-green start dot (skip those pixels)
        const isGreenDot = data[i + 1] > 180 && data[i] < 100;
        if (!isGreenDot) {
          pts.push({ x: px, y: py });
        }
      }
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Star-burst celebration overlay
// ---------------------------------------------------------------------------

const STAR_COLORS = [
  "#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c",
];

function StarBurst({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * 360;
            const dist = 120 + Math.random() * 80;
            const color = STAR_COLORS[i % STAR_COLORS.length];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
                animate={{
                  opacity: 0,
                  x: Math.cos((angle * Math.PI) / 180) * dist,
                  y: Math.sin((angle * Math.PI) / 180) * dist,
                  scale: 1.5,
                }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{ position: "absolute" }}
              >
                <Star size={36} color={color} fill={color} />
              </motion.div>
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Tracing canvas component
// ---------------------------------------------------------------------------

interface TracingCanvasProps {
  category: Category;
  item: string;
  is3yo: boolean;
  onSuccess: () => void;
  clearToken: number; // bump to clear
  /** Numeric Pokédex id — only present (and used) when category is "Pokemon". */
  pokemonId?: number;
}

// Extracted outlines are pure functions of the sprite, so they're cached
// across mounts/re-picks instead of re-tracing the same artwork every time
// a child revisits a Pokémon (extractOutlinePoints rasterises + walks the
// alpha mask, not free on a kiosk-class GPU-less CPU path).
const pokemonOutlineCache = new Map<number, Point[]>();

function TracingCanvas({
  category,
  item,
  is3yo,
  onSuccess,
  clearToken,
  pokemonId,
}: TracingCanvasProps) {
  const guideRef = useRef<HTMLCanvasElement>(null);
  const traceRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tracedPts = useRef<Point[]>([]);
  const succeeded = useRef(false);
  // Only one pointer drives a stroke at a time — a second finger touching
  // down mid-trace no longer jumps the line or blocks move-registration for
  // the first finger once it's captured (it's simply ignored).
  const activePointerId = useRef<number | null>(null);
  const dprRef = useRef(1);
  // Loaded outline points for the current Pokémon (null while loading or
  // for non-Pokémon categories).
  const pokemonPointsRef = useRef<Point[] | null>(null);

  // Size canvases to container. Uses offsetWidth/Height (layout box size)
  // rather than getBoundingClientRect (painted/visual size) so a canvas
  // sized while the parent's entrance animation is still mid-scale doesn't
  // get permanently under-sized — CSS transforms affect the latter but not
  // the former.
  const sizeCanvases = useCallback(() => {
    const container = containerRef.current;
    const guide = guideRef.current;
    const trace = traceRef.current;
    if (!container || !guide || !trace) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const sz = Math.min(container.offsetWidth, container.offsetHeight);
    guide.width = sz * dpr;
    guide.height = sz * dpr;
    guide.style.width = `${sz}px`;
    guide.style.height = `${sz}px`;
    trace.width = sz * dpr;
    trace.height = sz * dpr;
    trace.style.width = `${sz}px`;
    trace.style.height = `${sz}px`;
  }, []);

  // Redraw guide whenever item changes or canvas is resized
  const drawGuide = useCallback(() => {
    const canvas = guideRef.current;
    if (!canvas) return;
    if (category === "Shapes") {
      drawShapeGuide(canvas, item as ShapeName, dprRef.current);
    } else if (category === "Pokemon") {
      const pts = pokemonPointsRef.current;
      if (pts) {
        drawPokemonGuide(canvas, pts, dprRef.current);
      } else {
        // Outline still loading — leave blank; the load effect redraws
        // once it resolves.
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      drawLetterGuide(canvas, item, dprRef.current);
    }
  }, [category, item]);

  // Reset trace layer
  const clearTrace = useCallback(() => {
    const canvas = traceRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    tracedPts.current = [];
    succeeded.current = false;
  }, []);

  // Initial setup + resize observer + context-loss recovery. A 2D canvas on
  // a GPU-accelerated backing store can still lose its drawing buffer (e.g.
  // from WebGL-context churn elsewhere in a never-reloading kiosk session);
  // listening here means the guide repaints itself instead of staying
  // permanently blank if that ever happens.
  useEffect(() => {
    sizeCanvases();
    drawGuide();
    clearTrace();

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      sizeCanvases();
      drawGuide();
      clearTrace();
    };

    const guide = guideRef.current;
    const trace = traceRef.current;
    guide?.addEventListener("contextlost", handleContextLost);
    guide?.addEventListener("contextrestored", handleContextRestored);
    trace?.addEventListener("contextlost", handleContextLost);
    trace?.addEventListener("contextrestored", handleContextRestored);

    const ro = new ResizeObserver(() => {
      sizeCanvases();
      drawGuide();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      guide?.removeEventListener("contextlost", handleContextLost);
      guide?.removeEventListener("contextrestored", handleContextRestored);
      trace?.removeEventListener("contextlost", handleContextLost);
      trace?.removeEventListener("contextrestored", handleContextRestored);
    };
  }, [sizeCanvases, drawGuide, clearTrace]);

  // Clear trace on clearToken change
  useEffect(() => {
    clearTrace();
  }, [clearToken, clearTrace]);

  // Load (or reuse cached) outline points for the current Pokémon.
  useEffect(() => {
    if (category !== "Pokemon" || pokemonId === undefined) {
      pokemonPointsRef.current = null;
      return;
    }
    const cached = pokemonOutlineCache.get(pokemonId);
    if (cached) {
      pokemonPointsRef.current = cached;
      drawGuide();
      return;
    }
    pokemonPointsRef.current = null;
    let cancelled = false;
    void (async () => {
      const dotCount = is3yo ? 14 : 22;
      const pts = await extractOutlinePoints(ARTWORK(pokemonId), dotCount);
      if (cancelled) return;
      const finalPts = pts ?? starPolygon(10);
      pokemonOutlineCache.set(pokemonId, finalPts);
      pokemonPointsRef.current = finalPts;
      drawGuide();
    })();
    return () => {
      cancelled = true;
    };
  }, [category, pokemonId, is3yo, drawGuide]);

  // Coverage check
  const checkCoverage = useCallback(() => {
    if (succeeded.current) return;
    const minPoints = 30;
    if (tracedPts.current.length < minPoints) return;
    const guideCanvas = guideRef.current;
    if (!guideCanvas) return;
    let guidePts = sampleGuidePoints(guideCanvas, 16);
    if (guidePts.length === 0) {
      // Self-heal: a blanked-but-correctly-sized canvas (context event, or
      // a Pokémon outline that finished loading after the last paint) can
      // still be recovered by redrawing once before giving up.
      if (guideCanvas.width > 0 && guideCanvas.height > 0) {
        drawGuide();
        guidePts = sampleGuidePoints(guideCanvas, 16);
      }
      if (guidePts.length === 0) return;
    }

    const dpr = dprRef.current;
    const { thresholdPx, minRatio } = coverageParamsFor(category, is3yo);
    const threshold = thresholdPx * dpr;
    const threshold2 = threshold * threshold;

    let covered = 0;
    for (const gp of guidePts) {
      for (const tp of tracedPts.current) {
        const dx = gp.x - tp.x;
        const dy = gp.y - tp.y;
        if (dx * dx + dy * dy <= threshold2) {
          covered++;
          break;
        }
      }
    }
    const ratio = covered / guidePts.length;
    if (ratio >= minRatio) {
      succeeded.current = true;
      onSuccess();
    }
  }, [category, is3yo, onSuccess, drawGuide]);

  // Pointer event handlers
  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = traceRef.current!;
      const rect = canvas.getBoundingClientRect();
      const dpr = dprRef.current;
      return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Ignore a second finger touching down while the first is still
      // drawing — one stroke at a time keeps the line from jumping.
      if (activePointerId.current !== null) return;
      activePointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      const pt = getCanvasPoint(e);
      tracedPts.current.push(pt);
      const canvas = traceRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    },
    [getCanvasPoint],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      const pt = getCanvasPoint(e);
      tracedPts.current.push(pt);
      const canvas = traceRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = dprRef.current;
      ctx.lineWidth = 26 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    },
    [getCanvasPoint],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      activePointerId.current = null;
      checkCoverage();
    },
    [checkCoverage],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      activePointerId.current = null;
      // A cancelled gesture (e.g. the OS stealing the touch) may still have
      // covered enough ground to count — check instead of silently dropping
      // progress a 3yo already made.
      checkCoverage();
    },
    [checkCoverage],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full"
    >
      {/* Faint watermark of the real artwork — helps a child recognise the
          Pokémon while they trace its outline. Same inset fraction as the
          guide's own point mapping, so they line up. */}
      {category === "Pokemon" && pokemonId !== undefined && (
        <img
          src={ARTWORK(pokemonId)}
          onError={onSpriteError}
          alt=""
          aria-hidden="true"
          className="absolute inset-[8%] object-contain pointer-events-none select-none opacity-10 grayscale rounded-2xl"
        />
      )}
      {/* Guide layer (bottom) */}
      <canvas
        ref={guideRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
        aria-hidden="true"
      />
      {/* Trace layer (top, receives touch events) */}
      <canvas
        ref={traceRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ cursor: "crosshair" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TracingPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();
  const is3yo = (profile?.age ?? 5) <= 3;

  const [category, setCategory] = useState<Category>("ABC");
  const [itemIdx, setItemIdx] = useState(0);
  const [clearToken, setClearToken] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  // Pending auto-advance timer — cancelled on manual navigation so a tap
  // during the celebration can't double-skip.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAutoAdvance = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const items = useMemo(() => itemsFor(category), [category]);
  const item = items[itemIdx];
  const pokemonId =
    category === "Pokemon" ? pokemonIdFromItem(item) : undefined;

  // Prefetch utterances when category changes
  useEffect(() => {
    void prefetch(
      items.map((it) => ({ text: utteranceFor(category, it), lang: "en" as const })),
    );
  }, [category, items]);

  // Speak item name on mount and item change
  useEffect(() => {
    void speakText(utteranceFor(category, item), "en");
  }, [category, item]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopSpeaking();
      cancelAutoAdvance();
    },
    [cancelAutoAdvance],
  );

  const handleTabChange = useCallback(
    (cat: Category) => {
      playTap();
      stopSpeaking();
      cancelAutoAdvance();
      setCategory(cat);
      setItemIdx(0);
      setClearToken((t) => t + 1);
      setShowBurst(false);
    },
    [cancelAutoAdvance],
  );

  const handlePrev = useCallback(() => {
    playTap();
    cancelAutoAdvance();
    setItemIdx((i) => (i - 1 + items.length) % items.length);
    setClearToken((t) => t + 1);
    setShowBurst(false);
  }, [items.length, cancelAutoAdvance]);

  const handleNext = useCallback(() => {
    playTap();
    cancelAutoAdvance();
    setItemIdx((i) => (i + 1) % items.length);
    setClearToken((t) => t + 1);
    setShowBurst(false);
  }, [items.length, cancelAutoAdvance]);

  const handleClear = useCallback(() => {
    playTap();
    cancelAutoAdvance();
    setClearToken((t) => t + 1);
    setShowBurst(false);
  }, [cancelAutoAdvance]);

  const handleSpeak = useCallback(() => {
    playTap();
    void speakText(utteranceFor(category, item), "en");
  }, [category, item]);

  const handleSuccess = useCallback(() => {
    playCorrect();
    setShowBurst(true);
    void speakText(utteranceFor(category, item), "en");
    void logAttempt("tracing", questionIdFor(category, item), true);
    // Auto-advance after 1.6 s
    cancelAutoAdvance();
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      setShowBurst(false);
      setItemIdx((i) => (i + 1) % items.length);
      setClearToken((t) => t + 1);
    }, 1600);
  }, [category, item, items.length, logAttempt, cancelAutoAdvance]);

  // Board size: min(62vh, 56vw) as a CSS value used via inline style
  const boardSize = "min(62vh, 56vw)";

  const TABS: Category[] = ["ABC", "123", "Shapes", "Pokemon"];

  return (
    <div className="flex flex-col h-full px-4 py-3 gap-3">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate("/home")}
          className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0"
          aria-label="Back to home"
        >
          <ArrowLeft size={40} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-2xl font-black text-gray-500 leading-tight">Tracing</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={`${category}-${item}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-4xl font-black text-[#3b82f6] leading-tight truncate"
            >
              Trace: {displayLabelFor(category, item)}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Speaker button */}
        <button
          onClick={handleSpeak}
          className="w-[88px] h-[88px] rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0"
          aria-label="Hear the name"
        >
          <Volume2 size={40} className="text-[#3b82f6]" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-3 flex-shrink-0">
        {TABS.map((cat) => (
          <button
            key={cat}
            onClick={() => handleTabChange(cat)}
            className={[
              "flex-1 h-[88px] rounded-2xl text-2xl font-black transition-all",
              category === cat
                ? "bg-[#3b82f6] text-white shadow-lg scale-105"
                : "bg-gray-100 text-gray-600",
            ].join(" ")}
          >
            {TAB_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Tracing board + nav controls */}
      <div className="flex items-center justify-center gap-4 flex-1 min-h-0">
        {/* Prev button */}
        <button
          onClick={handlePrev}
          className="w-[100px] h-[100px] rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0"
          aria-label="Previous"
        >
          <ArrowLeft size={44} className="text-gray-600" />
        </button>

        {/* Board container */}
        <div
          className="relative flex-shrink-0 bg-white rounded-3xl shadow-xl border-4 border-gray-200 overflow-hidden"
          style={{ width: boardSize, height: boardSize }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${item}-${clearToken}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0"
            >
              <TracingCanvas
                category={category}
                item={item}
                is3yo={is3yo}
                onSuccess={handleSuccess}
                clearToken={clearToken}
                pokemonId={pokemonId}
              />
            </motion.div>
          </AnimatePresence>

          {/* Reveal the full-colour artwork once a Pokémon outline is
              successfully traced — the guide underneath is only a faded
              outline, so this is the "big reveal" for the activity. */}
          <AnimatePresence>
            {showBurst && category === "Pokemon" && pokemonId !== undefined && (
              <motion.img
                key="pokemon-reveal"
                src={ARTWORK(pokemonId)}
                onError={onSpriteError}
                alt={displayLabelFor(category, item)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 160 }}
                className="absolute inset-[8%] object-contain pointer-events-none select-none z-20"
              />
            )}
          </AnimatePresence>

          {/* Star burst overlay */}
          <StarBurst show={showBurst} />

          {/* "Well done!" celebration text */}
          <AnimatePresence>
            {showBurst && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center z-40"
              >
                <div className="bg-white/90 rounded-3xl px-8 py-5 shadow-2xl text-center">
                  <Star size={52} className="text-yellow-400 fill-yellow-400 mx-auto mb-2" />
                  <p className="text-4xl font-black text-[#3b82f6]">
                    {is3yo ? "Yay!" : "Great job!"}
                  </p>
                  {category === "Pokemon" && (
                    <p className="text-2xl font-black text-gray-700 mt-1">
                      {displayLabelFor(category, item)}!
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint text (always visible, non-blocking) */}
          {!showBurst && (
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center z-10">
              <span className="text-base font-bold text-gray-400 bg-white/70 rounded-full px-4 py-1">
                {category === "Pokemon"
                  ? "Trace the outline with your finger!"
                  : "Trace the shape with your finger!"}
              </span>
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-[100px] h-[100px] rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0"
          aria-label="Next"
        >
          <ArrowRight size={44} className="text-gray-600" />
        </button>
      </div>

      {/* Bottom controls row */}
      <div className="flex justify-center gap-4 flex-shrink-0 pb-1">
        {/* Clear / try again */}
        <button
          onClick={handleClear}
          className="h-[88px] px-8 rounded-2xl bg-orange-100 text-orange-700 text-xl font-black flex items-center gap-3"
          aria-label="Clear — try again"
        >
          <RotateCcw size={32} />
          Try Again
        </button>
      </div>
    </div>
  );
}
