// ---------------------------------------------------------------------------
// stickers.tsx — Sticker Book (route /stickers)
//
// Stickers unlock purely from the child's EXISTING play history (see
// src/content/stickers.ts) — there is no new "game" here, just a reward
// shelf built from api.getStats(). Locked stickers show as friendly "???"
// silhouettes (mystery, not shameful). Unlocked stickers can be dragged from
// the shelf onto one of three decorate-able scenes; placements persist per
// profile in localStorage. A "New sticker!" celebration plays the first
// time a sticker is seen unlocked since the child's last visit.
//
// Positive feedback only, no failure states: locked stickers just encourage
// "keep playing", nothing is ever marked wrong.
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, type PanInfo } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, HelpCircle, Sparkles, Trash2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { api } from "@/lib/api";
import {
  STICKERS,
  SCENES,
  isStickerUnlocked,
  getUnlockedStickers,
  type Sticker,
  type SceneKey,
  type StatsLike,
} from "@/content/stickers";

const SPRITE = ARTWORK;

const KEEP_PLAYING_HINT = "Keep playing to find this surprise!";

// PanInfo.point is page-relative (pageX/pageY), but every hit-test here
// compares it against getBoundingClientRect(), which is viewport-relative.
// Subtracting the current scroll offset converts page coords -> client
// coords so drops line up with the finger regardless of page scroll.
function clientPointFromPanInfo(info: PanInfo): { x: number; y: number } {
  return {
    x: info.point.x - window.scrollX,
    y: info.point.y - window.scrollY,
  };
}

// ---------------------------------------------------------------------------
// Placement persistence (per-profile localStorage, guarded — see AGENTS.md
// §9 for the key convention this follows).
// ---------------------------------------------------------------------------

interface Placement {
  id: string;
  scene: SceneKey;
  stickerId: string;
  xPct: number;
  yPct: number;
}

function placementsKey(profileId: number | undefined): string {
  return `letslearnos:stickers:v1:${profileId ?? "guest"}:placements`;
}

function seenKey(profileId: number | undefined): string {
  return `letslearnos:stickers:v1:${profileId ?? "guest"}:seen`;
}

function isPlacement(v: unknown): v is Placement {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.scene === "string" &&
    typeof p.stickerId === "string" &&
    typeof p.xPct === "number" &&
    typeof p.yPct === "number"
  );
}

function readPlacements(key: string): Placement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPlacement) : [];
  } catch {
    return [];
  }
}

function writePlacements(key: string, placements: Placement[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(placements));
  } catch {
    // Sticker Book still works without persistence — placements just won't
    // survive a reload.
  }
}

function readSeen(key: string): Set<string> {
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

function writeSeen(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Non-critical — worst case a sticker celebrates again next visit.
  }
}

function newPlacementId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Scene backdrops — plain CSS gradients + a few decorative divs, no assets.
// ---------------------------------------------------------------------------

const NIGHT_STARS = [
  { top: "12%", left: "8%" }, { top: "20%", left: "22%" }, { top: "9%", left: "38%" },
  { top: "28%", left: "55%" }, { top: "15%", left: "70%" }, { top: "34%", left: "85%" },
  { top: "42%", left: "15%" }, { top: "48%", left: "40%" }, { top: "38%", left: "62%" },
  { top: "24%", left: "92%" }, { top: "6%", left: "55%" }, { top: "45%", left: "5%" },
];

function SceneBackdrop({ sceneKey }: { sceneKey: SceneKey }) {
  const scene = SCENES.find((s) => s.key === sceneKey);
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ background: scene?.gradient }}
    >
      {sceneKey === "meadow" && (
        <>
          <div
            className="absolute rounded-full bg-yellow-200"
            style={{ width: 90, height: 90, top: "8%", right: "10%", boxShadow: "0 0 40px 14px rgba(255,241,150,0.6)" }}
          />
          <div className="absolute rounded-full bg-white/85" style={{ width: 70, height: 32, top: "16%", left: "10%" }} />
          <div className="absolute rounded-full bg-white/75" style={{ width: 46, height: 22, top: "24%", left: "20%" }} />
        </>
      )}
      {sceneKey === "beach" && (
        <>
          <div
            className="absolute rounded-full bg-orange-200"
            style={{ width: 80, height: 80, top: "9%", left: "12%", boxShadow: "0 0 40px 14px rgba(255,214,150,0.6)" }}
          />
          <div className="absolute inset-x-0" style={{ top: "48%", height: 3, background: "rgba(255,255,255,0.55)" }} />
          <div className="absolute inset-x-0" style={{ top: "55%", height: 3, background: "rgba(255,255,255,0.4)" }} />
          <div className="absolute inset-x-0" style={{ top: "63%", height: 3, background: "rgba(255,255,255,0.3)" }} />
        </>
      )}
      {sceneKey === "night" && (
        <>
          <div
            className="absolute rounded-full bg-yellow-100"
            style={{ width: 64, height: 64, top: "10%", right: "14%", boxShadow: "0 0 30px 10px rgba(255,250,200,0.45)" }}
          />
          {NIGHT_STARS.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{ width: 5, height: 5, top: p.top, left: p.left, opacity: 0.9 }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shelf sticker (unlocked, draggable onto the active scene)
// ---------------------------------------------------------------------------

interface ShelfStickerProps {
  sticker: Sticker;
  sceneRef: React.RefObject<HTMLDivElement | null>;
  onPlace: (sticker: Sticker, xPct: number, yPct: number) => void;
}

function ShelfSticker({ sticker, sceneRef, onPlace }: ShelfStickerProps) {
  // The shelf wrapper scrolls (overflow-y-auto), which clips any child that
  // moves outside its box via transform — including this sticker mid-drag.
  // While dragging we hide the real (drag-registered) element in place and
  // render a portal ghost that follows the pointer outside the clip box, so
  // it stays visible all the way to the scene.
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const handleDragStart = useCallback(() => {
    playTap();
  }, []);

  const handleDrag = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragPos(clientPointFromPanInfo(info));
  }, []);

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setDragPos(null);
      const rect = sceneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, y } = clientPointFromPanInfo(info);
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return; // dropped outside the scene — snaps back to the shelf.
      }
      const xPct = ((x - rect.left) / rect.width) * 100;
      const yPct = ((y - rect.top) / rect.height) * 100;
      onPlace(sticker, xPct, yPct);
    },
    [sceneRef, sticker, onPlace],
  );

  return (
    <>
      <motion.div
        drag
        dragSnapToOrigin
        dragElastic={0.15}
        dragMomentum={false}
        whileDrag={{ scale: 1.18, zIndex: 50 }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onTap={() => void speakText(sticker.label, "en")}
        style={{ width: 120, height: 120, touchAction: "none", opacity: dragPos ? 0 : 1 }}
        className="relative shrink-0 rounded-3xl bg-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing"
        aria-label={`${sticker.label} — drag onto the scene`}
      >
        <img
          src={SPRITE(sticker.pokemonId)}
          onError={onSpriteError}
          alt={sticker.label}
          className="w-[82%] h-[82%] object-contain pointer-events-none select-none"
          draggable={false}
        />
      </motion.div>
      {dragPos &&
        createPortal(
          <div
            aria-hidden="true"
            className="fixed rounded-3xl bg-white shadow-2xl flex items-center justify-center pointer-events-none"
            style={{
              width: 120,
              height: 120,
              left: dragPos.x - 60,
              top: dragPos.y - 60,
              transform: "scale(1.18)",
              zIndex: 999,
            }}
          >
            <img
              src={SPRITE(sticker.pokemonId)}
              onError={onSpriteError}
              alt=""
              className="w-[82%] h-[82%] object-contain"
              draggable={false}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Locked sticker (mystery silhouette)
// ---------------------------------------------------------------------------

function LockedSticker({ onTap }: { onTap: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onTap}
      style={{ width: 120, height: 120 }}
      className="relative shrink-0 rounded-3xl bg-gray-200 shadow-inner flex items-center justify-center"
      aria-label="Mystery sticker — keep playing to unlock"
    >
      <div className="w-[76%] h-[76%] rounded-full bg-gray-400/70 flex items-center justify-center">
        <HelpCircle size={46} className="text-white" />
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Placed sticker (inside a scene, re-draggable to reposition)
// ---------------------------------------------------------------------------

interface PlacedStickerProps {
  placement: Placement;
  sticker: Sticker;
  sceneRef: React.RefObject<HTMLDivElement | null>;
  onMove: (id: string, xPct: number, yPct: number) => void;
}

function PlacedSticker({ placement, sticker, sceneRef, onMove }: PlacedStickerProps) {
  // Position is driven by left/top percentages; drag itself only produces a
  // transform delta on top of that. Without resetting x/y after each move,
  // the delta accumulates on top of the next left/top and the sticker jumps
  // roughly double the dragged distance on every subsequent reposition. The
  // layout effect (keyed on the persisted position) resets the transform in
  // the same paint as the left/top update, so there's no visible jump.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
  }, [placement.xPct, placement.yPct, x, y]);

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const rect = sceneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x: px, y: py } = clientPointFromPanInfo(info);
      const xPct = Math.min(100, Math.max(0, ((px - rect.left) / rect.width) * 100));
      const yPct = Math.min(100, Math.max(0, ((py - rect.top) / rect.height) * 100));
      onMove(placement.id, xPct, yPct);
    },
    [sceneRef, placement.id, onMove],
  );

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={sceneRef}
      whileDrag={{ scale: 1.15, zIndex: 40 }}
      onDragStart={() => playTap()}
      onDragEnd={handleDragEnd}
      onTap={() => void speakText(sticker.label, "en")}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      className="absolute cursor-grab active:cursor-grabbing"
      style={{
        x,
        y,
        left: `${placement.xPct}%`,
        top: `${placement.yPct}%`,
        width: 100,
        height: 100,
        marginLeft: -50,
        marginTop: -50,
        touchAction: "none",
      }}
      aria-label={sticker.label}
    >
      <img
        src={SPRITE(sticker.pokemonId)}
        onError={onSpriteError}
        alt={sticker.label}
        className="w-full h-full object-contain drop-shadow-xl pointer-events-none select-none"
        draggable={false}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StickersPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();

  const [stats, setStats] = useState<StatsLike | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeScene, setActiveScene] = useState<SceneKey>("meadow");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [celebrating, setCelebrating] = useState<Sticker[]>([]);

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const celebrationCheckedRef = useRef(false);
  const loggedPlacementVisitRef = useRef(false);

  // Load this profile's saved placements once we know who's playing.
  useEffect(() => {
    setPlacements(readPlacements(placementsKey(profile?.id)));
  }, [profile?.id]);

  // Fetch play-history stats (drives which stickers are unlocked).
  useEffect(() => {
    if (!profile) return;
    setStatsLoading(true);
    api
      .getStats(profile.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [profile]);

  // Prefetch every phrase this page might speak.
  useEffect(() => {
    void prefetch([
      ...STICKERS.map((s) => ({ text: s.label, lang: "en" as const })),
      ...SCENES.map((s) => ({ text: s.label, lang: "en" as const })),
      { text: KEEP_PLAYING_HINT, lang: "en" as const },
      { text: "New sticker!", lang: "en" as const },
    ]);
    return () => stopSpeaking();
  }, []);

  const unlockedIds = useMemo(
    () => new Set(getUnlockedStickers(stats).map((s) => s.id)),
    [stats],
  );

  // Celebrate any sticker unlocked since the child's last visit. Runs once
  // per profile session, as soon as stats have loaded.
  useEffect(() => {
    if (!profile || statsLoading || celebrationCheckedRef.current) return;
    celebrationCheckedRef.current = true;
    const key = seenKey(profile.id);
    const seen = readSeen(key);
    const freshlyUnlocked = STICKERS.filter(
      (s) => unlockedIds.has(s.id) && !seen.has(s.id),
    );
    if (freshlyUnlocked.length > 0) {
      setCelebrating(freshlyUnlocked);
      playFanfare();
      playJingle();
      void speakText(
        freshlyUnlocked.length === 1 ? "New sticker!" : "New stickers!",
        "en",
      );
    }
  }, [profile, statsLoading, unlockedIds]);

  const handleDismissCelebration = useCallback(() => {
    playTap();
    if (profile) {
      const key = seenKey(profile.id);
      const seen = readSeen(key);
      celebrating.forEach((s) => seen.add(s.id));
      writeSeen(key, seen);
    }
    setCelebrating([]);
  }, [profile, celebrating]);

  const persistPlacements = useCallback(
    (next: Placement[]) => {
      setPlacements(next);
      writePlacements(placementsKey(profile?.id), next);
    },
    [profile?.id],
  );

  const handlePlace = useCallback(
    (sticker: Sticker, xPct: number, yPct: number) => {
      const placement: Placement = {
        id: newPlacementId(),
        scene: activeScene,
        stickerId: sticker.id,
        xPct,
        yPct,
      };
      persistPlacements([...placements, placement]);
      playCorrect();
      void speakText(sticker.label, "en");
      if (!loggedPlacementVisitRef.current) {
        loggedPlacementVisitRef.current = true;
        void logAttempt("stickers", "visit-with-placement", true);
      }
    },
    [activeScene, placements, persistPlacements, logAttempt],
  );

  const handleMove = useCallback(
    (id: string, xPct: number, yPct: number) => {
      persistPlacements(
        placements.map((p) => (p.id === id ? { ...p, xPct, yPct } : p)),
      );
    },
    [placements, persistPlacements],
  );

  const handleClearScene = useCallback(() => {
    playTap();
    persistPlacements(placements.filter((p) => p.scene !== activeScene));
  }, [placements, persistPlacements, activeScene]);

  const handleLockedTap = useCallback(() => {
    playTap();
    void speakText(KEEP_PLAYING_HINT, "en");
  }, []);

  const handleSceneTab = useCallback((key: SceneKey) => {
    playTap();
    setActiveScene(key);
  }, []);

  const stickerById = useMemo(
    () => new Map(STICKERS.map((s) => [s.id, s])),
    [],
  );

  const scenePlacements = placements.filter((p) => p.scene === activeScene);
  const unlockedCount = unlockedIds.size;

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-3">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/home")}
          aria-label="Back to Home"
          className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200"
        >
          <ArrowLeft size={44} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black text-pokemon-blue leading-tight">
            Sticker Book
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            {unlockedCount} / {STICKERS.length} stickers found
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
            <motion.div
              className="bg-pokemon-blue h-3 rounded-full"
              animate={{ width: `${(unlockedCount / STICKERS.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Scene tabs */}
      <div className="flex gap-3 shrink-0">
        {SCENES.map((s) => (
          <motion.button
            key={s.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSceneTab(s.key)}
            className="flex-1 min-h-[88px] rounded-2xl font-black text-xl flex items-center justify-center transition-all"
            style={{
              background: activeScene === s.key ? "#3b4cca" : "#f3f4f6",
              color: activeScene === s.key ? "white" : "#4b5563",
              boxShadow: activeScene === s.key ? "0 4px 0 #2a3899" : undefined,
            }}
            aria-pressed={activeScene === s.key}
          >
            {s.label}
          </motion.button>
        ))}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleClearScene}
          disabled={scenePlacements.length === 0}
          aria-label="Clear this scene"
          className="w-[88px] min-h-[88px] rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-1 disabled:opacity-40 shrink-0"
        >
          <Trash2 size={28} />
          <span className="text-xs font-bold">Clear</span>
        </motion.button>
      </div>

      {/* Scene canvas */}
      <div
        ref={sceneRef}
        className="relative w-full rounded-3xl shadow-xl border-4 border-white overflow-hidden shrink-0"
        style={{ height: "min(48vh, 560px)" }}
      >
        <SceneBackdrop sceneKey={activeScene} />
        <AnimatePresence>
          {scenePlacements.map((p) => {
            const sticker = stickerById.get(p.stickerId);
            if (!sticker) return null;
            return (
              <PlacedSticker
                key={p.id}
                placement={p}
                sticker={sticker}
                sceneRef={sceneRef}
                onMove={handleMove}
              />
            );
          })}
        </AnimatePresence>
        {scenePlacements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-2xl font-black text-white/80 drop-shadow px-6 text-center">
              Drag a sticker here!
            </p>
          </div>
        )}
      </div>

      {/* Shelf */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <p className="text-lg font-bold text-gray-500 shrink-0">
          Your stickers
        </p>
        {statsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-14 h-14 border-6 border-pokemon-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-wrap gap-4 pb-3">
              {STICKERS.map((sticker) =>
                unlockedIds.has(sticker.id) ? (
                  <ShelfSticker
                    key={sticker.id}
                    sticker={sticker}
                    sceneRef={sceneRef}
                    onPlace={handlePlace}
                  />
                ) : (
                  <LockedSticker key={sticker.id} onTap={handleLockedTap} />
                ),
              )}
            </div>
          </div>
        )}
      </div>

      {/* "New sticker!" celebration */}
      <AnimatePresence>
        {celebrating.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="bg-white rounded-[40px] shadow-2xl px-10 py-10 flex flex-col items-center gap-5 max-w-2xl text-center"
            >
              <Sparkles size={56} className="text-pokemon-yellow" />
              <h2 className="text-5xl font-black text-pokemon-blue">
                New sticker!
              </h2>
              <div className="flex gap-4 flex-wrap justify-center">
                {celebrating.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, y: [0, -12, 0] }}
                    transition={{
                      delay: 0.1 + i * 0.08,
                      type: "spring",
                      stiffness: 260,
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <img
                      src={SPRITE(s.pokemonId)}
                      onError={onSpriteError}
                      alt={s.label}
                      className="w-28 h-28 object-contain drop-shadow-xl"
                    />
                    <span className="text-lg font-black text-gray-700">
                      {s.label}
                    </span>
                  </motion.div>
                ))}
              </div>
              <p className="text-2xl font-bold text-gray-600">
                {celebrating.length === 1
                  ? "You earned a new sticker!"
                  : `You earned ${celebrating.length} new stickers!`}
              </p>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handleDismissCelebration}
                className="bg-pokemon-blue text-white text-2xl font-black px-10 py-5 rounded-3xl shadow-xl min-h-[88px] min-w-[200px]"
              >
                Yay!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
