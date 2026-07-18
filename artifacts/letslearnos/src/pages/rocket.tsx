// Rocket Launch — /rocket (ADR-019)
//
// One page, two phases sharing a single persistent 3D scene
// (components/RocketScene.tsx): LEARN (tap a rocket part — raycast or the
// >=88px picker dock — to highlight it, zoom the camera in, and hear a
// 2-sentence kid-level explanation) and LAUNCH (huge >=120px LAUNCH button
// -> spoken countdown -> ignition -> liftoff -> starfield orbit ->
// celebration). Exploring parts is encouraged by the intro narration but
// never required — the LAUNCH button is always enabled from the moment the
// page loads, so a child can never get stuck (ADR-019).
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CircleDot,
  Cone,
  Flame,
  Fuel,
  Rocket as RocketIcon,
  RotateCcw,
  Shield,
  Triangle,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { RocketScene, type RocketEvent, type RocketHandle } from "@/components/RocketScene";
import {
  allRocketSpokenLines,
  BLAST_OFF_WORD,
  getCountdownWords,
  getRocketPart,
  ROCKET_LABELS,
  ROCKET_LINES,
  ROCKET_PART_ORDER,
  speakablePart,
  type RocketPartId,
} from "@/content/rocket";
import { useSession } from "@/context/SessionContext";
import { playTap } from "@/lib/sound";
import { prefetch, speakSequence, speakText, stopSpeaking } from "@/lib/tts";

// The kiosk never scrolls, so the page needs a definite height — 120px =
// TopBar (88px) + App's pb-4 + breathing room. Matches science.tsx/space.tsx.
const PAGE_HEIGHT = "calc(100vh - 200px)";

// Safety net for ADR-019 ("a child must never get stuck"): if the 3D scene
// never reaches its "orbit" event — WebGL failed to start, or the context
// was lost mid-flight — this forces the celebration after a generous delay.
// A real flight (ignition -> orbit) takes ~5.5s on this hardware; 10s leaves
// plenty of headroom without leaving a child staring at a locked "Launching…"
// button for long.
const FLIGHT_WATCHDOG_MS = 10_000;

type RocketPagePhase = "learn" | "countdown" | "flight" | "celebrate";

const PART_ICONS: Record<RocketPartId, LucideIcon> = {
  "escape-tower": Shield,
  "nose-cone": Cone,
  capsule: CircleDot,
  fins: Triangle,
  "fuel-tank": Fuel,
  engines: Flame,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function RocketPage() {
  const [, navigate] = useLocation();
  const sceneRef = useRef<RocketHandle>(null);
  const { profile, logAttempt } = useSession();
  const is3yo = (profile?.age ?? 5) <= 3;

  const [phase, setPhase] = useState<RocketPagePhase>("learn");
  const [selectedPart, setSelectedPart] = useState<RocketPartId | null>(null);
  const [countdownWord, setCountdownWord] = useState<string | null>(null);

  // Cancellation plumbing for the async countdown loop and the flight
  // milestone narration (see startLaunchSequence / handleEvent below).
  // mountedRef stops the countdown loop from continuing to speak once the
  // page has been navigated away from; flightGenRef + completedRef guard
  // against stale/duplicate events (a stray watchdog vs. a real "orbit"
  // event, or leftover events from a previous flight after Fly Again).
  const mountedRef = useRef(true);
  const flightGenRef = useRef(0);
  const completedRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrationChainRef = useRef<Promise<void>>(Promise.resolve());

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  // Flight milestone lines arrive in quick succession (see RocketScene's
  // physics — gaps between ignition/liftoff/sky-darkening/reaching-space can
  // be under a second) and each line takes longer than that to speak.
  // speakText/speakSequence always interrupt whatever's currently playing,
  // so calling it directly from each event would chop every line. Chaining
  // them through this promise queue instead makes each line wait for the
  // previous one to finish before it starts, so nothing gets cut off. `gen`
  // stops a stale flight's queued lines from playing after a Fly Again /
  // unmount / explicit "Say It Again" interrupts.
  const queueFlightLine = useCallback((text: string, gen: number) => {
    narrationChainRef.current = narrationChainRef.current.then(() => {
      if (!mountedRef.current || flightGenRef.current !== gen) return undefined;
      return speakText(text, "en");
    });
  }, []);

  // Warm every spoken line as soon as the page mounts (same discipline as
  // space.tsx/science.tsx), then narrate the intro. Exploring parts is
  // explicitly framed as optional here (ADR-019).
  useEffect(() => {
    void prefetch(allRocketSpokenLines().map((text) => ({ text, lang: "en" as const })));
    void speakSequence([
      { text: ROCKET_LINES.introWelcome, lang: "en" },
      { text: ROCKET_LINES.introHint, lang: "en" },
    ]);
    return () => {
      mountedRef.current = false;
      clearWatchdog();
      stopSpeaking();
    };
  }, [clearWatchdog]);

  const choosePart = useCallback(
    (id: RocketPartId) => {
      if (phase !== "learn") return;
      playTap();
      setSelectedPart(id);
      const part = getRocketPart(id);
      if (part) void speakText(speakablePart(part), "en");
    },
    [phase],
  );

  const backToRocket = () => {
    playTap();
    stopSpeaking();
    setSelectedPart(null);
  };

  // Shared by the real "orbit" event AND the flight watchdog below, so a
  // stuck/failed 3D scene still reaches the celebration (ADR-019: "a child
  // must never get stuck") instead of leaving controlsLocked forever.
  // completedRef makes this idempotent in case both fire (e.g. the watchdog
  // races a late-arriving real orbit event).
  const completeLaunch = useCallback(
    (gen: number) => {
      if (flightGenRef.current !== gen || completedRef.current) return;
      completedRef.current = true;
      clearWatchdog();
      setPhase("celebrate");
      queueFlightLine(ROCKET_LINES.celebrationLine, gen);
      queueFlightLine(ROCKET_LINES.speedFactLine, gen);
      void logAttempt("rocket", "launch-complete", true);
    },
    [logAttempt, queueFlightLine, clearWatchdog],
  );

  const handleEvent = useCallback(
    (event: RocketEvent) => {
      const gen = flightGenRef.current;
      switch (event.type) {
        case "ignition":
          queueFlightLine(ROCKET_LINES.ignitionLine, gen);
          return;
        case "liftoff":
          queueFlightLine(ROCKET_LINES.liftoffLine, gen);
          return;
        case "sky-darkening":
          queueFlightLine(ROCKET_LINES.skyDarkeningLine, gen);
          return;
        case "reaching-space":
          queueFlightLine(ROCKET_LINES.reachingSpaceLine, gen);
          return;
        case "orbit":
          completeLaunch(gen);
          return;
      }
    },
    [queueFlightLine, completeLaunch],
  );

  const handleSceneError = useCallback(() => {
    void speakText(ROCKET_LINES.webglFallbackLine, "en");
  }, []);

  // Controls lock the moment LAUNCH is pressed: the spoken countdown drives
  // both the huge on-screen numbers and the scene's ignition trigger, so the
  // visual count and the narration are always in lockstep.
  const startLaunchSequence = useCallback(async () => {
    if (phase !== "learn") return;
    playTap();
    stopSpeaking();
    setSelectedPart(null);
    setPhase("countdown");

    // mountedRef is checked after every await: stopSpeaking() on unmount
    // only cancels whatever utterance is CURRENTLY playing, so without this
    // guard the loop would keep starting fresh speakText() calls for every
    // remaining countdown word (and narrate right over whatever page the
    // child navigated to via Back).
    await Promise.all([speakText(ROCKET_LINES.countdownFraming, "en"), sleep(500)]);
    if (!mountedRef.current) return;
    for (const word of getCountdownWords(is3yo)) {
      setCountdownWord(word);
      // eslint-disable-next-line no-await-in-loop -- countdown must speak in order
      await Promise.all([speakText(word, "en"), sleep(650)]);
      if (!mountedRef.current) return;
    }
    setCountdownWord(BLAST_OFF_WORD);
    await Promise.all([speakText(BLAST_OFF_WORD, "en"), sleep(900)]);
    if (!mountedRef.current) return;
    setCountdownWord(null);

    const gen = flightGenRef.current + 1;
    flightGenRef.current = gen;
    completedRef.current = false;
    clearWatchdog();

    setPhase("flight");
    sceneRef.current?.startLaunch();

    // ADR-019 safety net: if the scene never fires "orbit" (WebGL failed to
    // start, or the context was lost mid-flight — see RocketScene's onError/
    // webglcontextlost handling), force the celebration anyway instead of
    // leaving the page locked in "flight" forever.
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      if (!mountedRef.current) return;
      completeLaunch(gen);
    }, FLIGHT_WATCHDOG_MS);
  }, [phase, is3yo, clearWatchdog, completeLaunch]);

  const flyAgain = useCallback(() => {
    playTap();
    stopSpeaking();
    clearWatchdog();
    flightGenRef.current += 1; // invalidate any still-queued flight narration
    completedRef.current = false;
    sceneRef.current?.resetToPad();
    setSelectedPart(null);
    setPhase("learn");
    void speakText(ROCKET_LINES.flyAgainLine, "en");
  }, [clearWatchdog]);

  const sayAgain = () => {
    playTap();
    if (phase === "celebrate") {
      flightGenRef.current += 1; // invalidate any still-queued flight narration
      void speakSequence([
        { text: ROCKET_LINES.celebrationLine, lang: "en" },
        { text: ROCKET_LINES.speedFactLine, lang: "en" },
      ]);
      return;
    }
    if (selectedPart) {
      const part = getRocketPart(selectedPart);
      if (part) void speakText(speakablePart(part), "en");
      return;
    }
    void speakSequence([
      { text: ROCKET_LINES.introWelcome, lang: "en" },
      { text: ROCKET_LINES.introHint, lang: "en" },
    ]);
  };

  const selectedPartData = selectedPart ? getRocketPart(selectedPart) : null;
  const controlsLocked = phase !== "learn";

  return (
    <div className="relative min-h-0 overflow-hidden bg-[#bfe3ff]" style={{ height: PAGE_HEIGHT }}>
      <RocketScene
        ref={sceneRef}
        selectedPart={selectedPart}
        interactive={phase === "learn"}
        onSelectPart={choosePart}
        onEvent={handleEvent}
        onError={handleSceneError}
        className="absolute inset-0 z-0"
      />

      <button
        onClick={() => {
          stopSpeaking();
          navigate("/home");
        }}
        className="absolute left-4 top-4 z-30 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 shadow-lg"
        aria-label={ROCKET_LABELS.backButton}
      >
        <ArrowLeft size={40} />
      </button>

      <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-slate-700 drop-shadow">
          {ROCKET_LABELS.kicker}
        </p>
        <h1 className="text-2xl font-black text-slate-900 drop-shadow">
          {ROCKET_LABELS.learnPageHeading}
        </h1>
      </div>

      {/* Huge countdown overlay — visually huge numbers in lockstep with the
          spoken countdown (see startLaunchSequence). Decorative/transient,
          not a control, so it's fine that it sits over the vertical center
          rather than avoiding the top 80px specifically. */}
      <AnimatePresence>
        {countdownWord && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <motion.p
              key={countdownWord}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.25, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-[10rem] font-black leading-none text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.35)]"
            >
              {countdownWord}
            </motion.p>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom stack: dock (parts + LAUNCH, always) + fact card / celebration
          card (conditional). column-reverse anchors the dock at the very
          bottom; cards grow upward above it (science.tsx precedent). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex flex-col-reverse items-center gap-3 px-4">
        <div className="pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-3xl bg-slate-900/80 px-4 py-3 shadow-xl backdrop-blur">
          {ROCKET_PART_ORDER.map((id) => {
            const part = getRocketPart(id);
            if (!part) return null;
            const Icon = PART_ICONS[id];
            const selected = id === selectedPart;
            return (
              <button
                key={id}
                onClick={() => choosePart(id)}
                disabled={controlsLocked}
                className={`flex h-[88px] min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 shadow-md transition ${
                  selected ? "bg-indigo-600 ring-4 ring-indigo-300" : "bg-slate-700/90"
                } ${controlsLocked ? "opacity-40" : ""}`}
                aria-label={`Learn about the ${part.label}`}
              >
                <Icon size={26} className="text-white" />
                <span className="text-xs font-black leading-tight text-white">{part.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => void startLaunchSequence()}
            disabled={controlsLocked}
            className="flex h-[120px] min-w-[170px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-orange-600 px-5 shadow-md transition disabled:opacity-60"
            aria-label={ROCKET_LABELS.launchButton}
          >
            <RocketIcon size={34} className="text-white" />
            <span className="text-lg font-black leading-tight text-white">
              {phase === "learn" ? ROCKET_LABELS.launchButton : ROCKET_LABELS.launchButtonLocked}
            </span>
          </button>
        </div>

        <AnimatePresence>
          {phase === "learn" && selectedPartData && (
            <motion.div
              key={selectedPartData.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              className="pointer-events-auto w-[min(600px,92vw)] overflow-hidden rounded-3xl bg-white/97 p-5 shadow-2xl backdrop-blur"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black text-slate-900">{selectedPartData.label}</h2>
                <button
                  onClick={sayAgain}
                  className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-pokemon-yellow text-pokemon-darkred shadow"
                  aria-label={ROCKET_LABELS.sayAgainLabel}
                >
                  <Volume2 size={26} />
                </button>
              </div>
              <p className="rounded-2xl bg-green-50 p-4 text-lg font-bold leading-snug text-slate-800">
                {selectedPartData.explanation}
              </p>
              <button
                onClick={backToRocket}
                className="mt-4 flex min-h-[88px] w-full items-center justify-center gap-2 rounded-3xl bg-slate-900 text-xl font-black text-white shadow-md"
              >
                <ArrowLeft size={26} />
                Back to Rocket
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "celebrate" && (
            <motion.div
              key="celebrate"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              className="pointer-events-auto w-[min(600px,92vw)] overflow-hidden rounded-3xl bg-white/97 p-5 shadow-2xl backdrop-blur"
            >
              <p className="text-2xl font-black text-green-700">{ROCKET_LINES.celebrationLine}</p>
              <p className="mt-2 rounded-2xl bg-green-50 p-4 text-lg font-bold leading-snug text-slate-800">
                {ROCKET_LINES.speedFactLine}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={sayAgain}
                  className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-pokemon-yellow text-pokemon-darkred shadow"
                  aria-label={ROCKET_LABELS.sayAgainLabel}
                >
                  <Volume2 size={32} />
                </button>
                <button
                  onClick={flyAgain}
                  className="flex min-h-[88px] flex-1 items-center justify-center gap-3 rounded-3xl bg-slate-900 px-5 text-xl font-black text-white shadow-md"
                >
                  <RotateCcw size={26} />
                  {ROCKET_LABELS.flyAgainButton}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
