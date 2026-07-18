// Science 3D Lab — /science (ADR-017 rebuild)
//
// Four hands-on 3D stations in one scene (see components/ScienceScene.tsx):
// put out a campfire with water or sand (always paired with fire-safety
// framing — GOAL §5), fill a basin, spin a windmill, and grow a seed into a
// flower. Every station is positive-only with no failure state; completing
// one logs a single `correct: true` attempt (src/content/stickers.ts's "any"
// milestone already covers modules like this one that don't appear in its
// UnlockModule union yet — see this file's bottom comment for the surfaced
// decision). Everything tappable narrates for the pre-reader (ADR-005).
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Droplets,
  Flame,
  Leaf,
  PaintBucket,
  RotateCcw,
  Sun,
  Volume2,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import {
  ScienceScene,
  type ScienceEvent,
  type ScienceHandle,
} from "@/components/ScienceScene";
import {
  FIRE_STATION,
  LAB_INTRO,
  PLANT_STATION,
  SAY_AGAIN_LABEL,
  STATIONS,
  STATION_ORDER,
  WATER_STATION,
  WIND_STATION,
  type FireTool,
  type StationId,
} from "@/content/science";
import { useSession } from "@/context/SessionContext";
import { playTap } from "@/lib/sound";
import { prefetch, speakSequence, speakText, stopSpeaking } from "@/lib/tts";

// The kiosk never scrolls, so the page needs a definite height — 120px =
// TopBar padding (88) + App's pb-4 + breathing room. Matches
// geography.tsx/space.tsx's PAGE_HEIGHT.
const PAGE_HEIGHT = "calc(100vh - 200px)";

const STATION_ICONS: Record<StationId, LucideIcon> = {
  fire: Flame,
  water: Droplets,
  wind: Wind,
  plant: Leaf,
};

export default function SciencePage() {
  const [, navigate] = useLocation();
  const sceneRef = useRef<ScienceHandle>(null);
  const { logAttempt } = useSession();

  const [activeStation, setActiveStation] = useState<StationId>("fire");
  const [fireTool, setFireTool] = useState<FireTool | null>(null);
  const [fireOut, setFireOut] = useState(false);
  const [fireCompletedTool, setFireCompletedTool] = useState<FireTool | null>(null);
  const [waterFull, setWaterFull] = useState(false);
  const [windComplete, setWindComplete] = useState(false);
  const [sunOut, setSunOut] = useState(false);
  const [plantStage, setPlantStage] = useState<0 | 1 | 2 | 3>(0);

  const stationCopy = STATIONS[activeStation];

  const handleEvent = useCallback(
    (event: ScienceEvent) => {
      switch (event.type) {
        case "fire-midway":
          void speakText(FIRE_STATION.midway, "en");
          return;
        case "fire-out": {
          const tool = fireTool ?? "hose";
          setFireOut(true);
          setFireCompletedTool(tool);
          void speakSequence([
            { text: FIRE_STATION.complete, lang: "en" },
            { text: FIRE_STATION.safetyOutro, lang: "en" },
            { text: FIRE_STATION.fact[tool], lang: "en" },
          ]);
          void logAttempt("science", "station-fire", true);
          return;
        }
        case "water-midway":
          void speakText(WATER_STATION.midway, "en");
          return;
        case "water-full":
          setWaterFull(true);
          void speakSequence([
            { text: WATER_STATION.complete, lang: "en" },
            { text: WATER_STATION.fact, lang: "en" },
          ]);
          void logAttempt("science", "station-water", true);
          return;
        case "wind-building":
          void speakText(WIND_STATION.building, "en");
          return;
        case "wind-complete":
          setWindComplete(true);
          void speakSequence([
            { text: WIND_STATION.complete, lang: "en" },
            { text: WIND_STATION.fact, lang: "en" },
          ]);
          void logAttempt("science", "station-wind", true);
          return;
        case "plant-sprout":
          setPlantStage(1);
          void speakText(PLANT_STATION.sprout, "en");
          return;
        case "plant-growing":
          setPlantStage(2);
          void speakText(PLANT_STATION.growing, "en");
          return;
        case "plant-complete":
          setPlantStage(3);
          void speakSequence([
            { text: PLANT_STATION.complete, lang: "en" },
            { text: PLANT_STATION.fact, lang: "en" },
          ]);
          void logAttempt("science", "station-plant", true);
          return;
      }
    },
    [fireTool, logAttempt],
  );

  // Narrate the lab intro, then the default (fire) station's intro + the
  // required safety line, and warm the TTS cache for every station so
  // switching stations / tapping "Say it again" speaks instantly.
  useEffect(() => {
    const allLines = [
      LAB_INTRO,
      FIRE_STATION.intro,
      FIRE_STATION.safetyIntro,
      FIRE_STATION.hint,
      FIRE_STATION.midway,
      FIRE_STATION.complete,
      FIRE_STATION.safetyOutro,
      FIRE_STATION.fact.hose,
      FIRE_STATION.fact.sand,
      WATER_STATION.intro,
      WATER_STATION.hint,
      WATER_STATION.midway,
      WATER_STATION.complete,
      WATER_STATION.fact,
      WIND_STATION.intro,
      WIND_STATION.hint,
      WIND_STATION.building,
      WIND_STATION.complete,
      WIND_STATION.fact,
      PLANT_STATION.intro,
      PLANT_STATION.hint,
      PLANT_STATION.sprout,
      PLANT_STATION.growing,
      PLANT_STATION.complete,
      PLANT_STATION.fact,
    ];
    void prefetch(allLines.map((text) => ({ text, lang: "en" as const })));
    void speakSequence([
      { text: LAB_INTRO, lang: "en" },
      { text: FIRE_STATION.intro, lang: "en" },
      { text: FIRE_STATION.safetyIntro, lang: "en" },
    ]);
    return () => stopSpeaking();
  }, []);

  const chooseStation = useCallback((id: StationId) => {
    playTap();
    setActiveStation(id);
    const copy = STATIONS[id];
    if (copy.id === "fire") {
      void speakSequence([
        { text: copy.intro, lang: "en" },
        { text: copy.safetyIntro, lang: "en" },
      ]);
    } else {
      void speakText(copy.intro, "en");
    }
  }, []);

  const chooseFireTool = (tool: FireTool) => {
    playTap();
    setFireTool(tool);
    void speakText(`${FIRE_STATION.toolLabel[tool]}. ${FIRE_STATION.hint}`, "en");
  };

  const bringOutSun = () => {
    playTap();
    setSunOut(true);
    void speakText(PLANT_STATION.sunButtonLabel, "en");
  };

  const sayAgain = () => {
    playTap();
    if (stationCopy.id === "fire") {
      if (fireOut) {
        void speakSequence([
          { text: stationCopy.complete, lang: "en" },
          { text: stationCopy.safetyOutro, lang: "en" },
          { text: stationCopy.fact[fireCompletedTool ?? "hose"], lang: "en" },
        ]);
      } else {
        void speakSequence([
          { text: stationCopy.hint, lang: "en" },
          { text: stationCopy.safetyIntro, lang: "en" },
        ]);
      }
      return;
    }
    if (stationCopy.id === "water") {
      void speakText(waterFull ? `${stationCopy.complete} ${stationCopy.fact}` : stationCopy.hint, "en");
      return;
    }
    if (stationCopy.id === "wind") {
      void speakText(windComplete ? `${stationCopy.complete} ${stationCopy.fact}` : stationCopy.hint, "en");
      return;
    }
    void speakText(plantStage >= 3 ? `${stationCopy.complete} ${stationCopy.fact}` : stationCopy.hint, "en");
  };

  const restartStation = () => {
    playTap();
    sceneRef.current?.resetActiveStation();
    if (activeStation === "fire") {
      setFireOut(false);
      setFireCompletedTool(null);
      setFireTool(null);
    } else if (activeStation === "water") {
      setWaterFull(false);
    } else if (activeStation === "wind") {
      setWindComplete(false);
    } else {
      setPlantStage(0);
      setSunOut(false);
    }
    void speakText(`${stationCopy.restartLabel}! ${stationCopy.hint}`, "en");
  };

  const stationComplete =
    (activeStation === "fire" && fireOut) ||
    (activeStation === "water" && waterFull) ||
    (activeStation === "wind" && windComplete) ||
    (activeStation === "plant" && plantStage >= 3);

  const factText =
    activeStation === "fire"
      ? FIRE_STATION.fact[fireCompletedTool ?? "hose"]
      : activeStation === "water"
        ? WATER_STATION.fact
        : activeStation === "wind"
          ? WIND_STATION.fact
          : PLANT_STATION.fact;

  return (
    <div className="relative min-h-0 overflow-hidden bg-[#bfe3ff]" style={{ height: PAGE_HEIGHT }}>
      <ScienceScene
        ref={sceneRef}
        activeStation={activeStation}
        fireTool={activeStation === "fire" ? fireTool : null}
        sunOut={sunOut}
        onEvent={handleEvent}
        className="absolute inset-0 z-0"
      />

      <button
        onClick={() => {
          stopSpeaking();
          navigate("/home");
        }}
        className="absolute left-4 top-4 z-30 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 shadow-lg"
        aria-label="Back"
      >
        <ArrowLeft size={40} />
      </button>

      <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-slate-700 drop-shadow">
          {stationCopy.kicker}
        </p>
        <h1 className="text-2xl font-black text-slate-900 drop-shadow">
          {stationCopy.title}
        </h1>
      </div>

      {activeStation === "fire" && (
        <div
          className="pointer-events-none absolute left-1/2 top-24 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-50/95 px-5 py-3 shadow-lg"
          role="status"
        >
          <Flame size={22} className="text-red-600" />
          <p className="text-base font-black text-red-800">
            {FIRE_STATION.safetyBadge}
          </p>
        </div>
      )}

      {/* Bottom stack: dock (always) + tool row (always) + fact card (once
          the active station's goal is reached). column-reverse so the dock
          stays anchored at the very bottom and rows above it grow upward
          without any manual pixel-stacking math. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex flex-col-reverse items-center gap-3 px-4">
        <div className="pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-3xl bg-slate-900/80 px-4 py-3 shadow-xl backdrop-blur">
          {STATION_ORDER.map((id) => {
            const Icon = STATION_ICONS[id];
            const selected = id === activeStation;
            return (
              <button
                key={id}
                onClick={() => chooseStation(id)}
                className={`flex h-[88px] min-w-[88px] flex-col items-center justify-center gap-1 rounded-2xl px-3 shadow-md transition ${
                  selected ? "bg-indigo-600 ring-4 ring-indigo-300" : "bg-slate-700/90"
                }`}
                aria-label={`Go to ${STATIONS[id].title}`}
              >
                <Icon size={26} className="text-white" />
                <span className="text-xs font-black leading-tight text-white">
                  {STATIONS[id].title.replace(" Station", "")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-3xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
          <button
            onClick={sayAgain}
            className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-pokemon-yellow text-pokemon-darkred shadow"
            aria-label={SAY_AGAIN_LABEL}
          >
            <Volume2 size={32} />
          </button>

          {activeStation === "fire" && (
            <>
              <button
                onClick={() => chooseFireTool("hose")}
                className={`flex h-[120px] min-w-[120px] flex-col items-center justify-center gap-1 rounded-2xl px-4 shadow-md transition ${
                  fireTool === "hose" ? "bg-sky-500 text-white ring-4 ring-sky-200" : "bg-sky-100 text-sky-900"
                }`}
                aria-label={FIRE_STATION.toolLabel.hose}
              >
                <Droplets size={34} />
                <span className="text-sm font-black leading-tight">{FIRE_STATION.toolLabel.hose}</span>
              </button>
              <button
                onClick={() => chooseFireTool("sand")}
                className={`flex h-[120px] min-w-[120px] flex-col items-center justify-center gap-1 rounded-2xl px-4 shadow-md transition ${
                  fireTool === "sand" ? "bg-amber-500 text-white ring-4 ring-amber-200" : "bg-amber-100 text-amber-900"
                }`}
                aria-label={FIRE_STATION.toolLabel.sand}
              >
                <PaintBucket size={34} />
                <span className="text-sm font-black leading-tight">{FIRE_STATION.toolLabel.sand}</span>
              </button>
              {!fireOut && (
                <p className="max-w-[220px] text-base font-bold leading-snug text-slate-600">
                  {FIRE_STATION.hint}
                </p>
              )}
            </>
          )}

          {activeStation === "water" && (
            <p className="max-w-[420px] text-base font-bold leading-snug text-slate-600">
              {WATER_STATION.hint}
            </p>
          )}

          {activeStation === "wind" && (
            <p className="max-w-[420px] text-base font-bold leading-snug text-slate-600">
              {WIND_STATION.hint}
            </p>
          )}

          {activeStation === "plant" && (
            <>
              <div className="flex h-[120px] min-w-[120px] flex-col items-center justify-center gap-1 rounded-2xl bg-sky-100 px-4 text-sky-900 shadow-md">
                <Droplets size={34} />
                <span className="text-sm font-black leading-tight">{PLANT_STATION.waterToolLabel}</span>
              </div>
              <button
                onClick={bringOutSun}
                className={`flex h-[120px] min-w-[120px] flex-col items-center justify-center gap-1 rounded-2xl px-4 shadow-md transition ${
                  sunOut ? "bg-yellow-400 text-yellow-950 ring-4 ring-yellow-200" : "bg-yellow-100 text-yellow-900"
                }`}
                aria-label={PLANT_STATION.sunButtonLabel}
              >
                <Sun size={34} />
                <span className="text-sm font-black leading-tight">{PLANT_STATION.sunButtonLabel}</span>
              </button>
              <p className="max-w-[220px] text-base font-bold leading-snug text-slate-600">
                {PLANT_STATION.hint}
              </p>
            </>
          )}
        </div>

        <AnimatePresence>
          {stationComplete && (
            <motion.div
              key={activeStation}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              className="pointer-events-auto w-[min(600px,92vw)] overflow-hidden rounded-3xl bg-white/97 p-5 shadow-2xl backdrop-blur"
            >
              <p className="text-2xl font-black text-green-700">{stationCopy.complete}</p>
              <p className="mt-2 rounded-2xl bg-green-50 p-4 text-lg font-bold leading-snug text-slate-800">
                {factText}
              </p>
              <button
                onClick={restartStation}
                className="mt-4 flex min-h-[88px] w-full items-center justify-center gap-3 rounded-3xl bg-slate-900 px-5 py-4 text-xl font-black text-white shadow-md"
              >
                <RotateCcw size={26} />
                {stationCopy.restartLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision surfaced for the next agent / DECISIONS.md, not silently applied:
// this page now calls logAttempt("science", ...) with `correct: true` on
// every station completion (positive-only, no failure path — matches
// seek/puzzle/coloring's logging discipline). src/content/stickers.ts's
// `UnlockModule` union and its header comment ("science... never appear in
// api.getStats().moduleBreakdown") are now stale — "science" is a real,
// reachable module key going forward. Sticker unlock rules were left
// untouched here per the build brief (file ownership + "don't silently
// change sticker rules"); a follow-up should decide whether to add a
// science-gated sticker and update that file's union/comment.
// ---------------------------------------------------------------------------
