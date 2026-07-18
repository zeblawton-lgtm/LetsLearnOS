import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Minus, Plus, Rocket, Sparkles, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import {
  SolarSystemScene,
  type SolarSystemHandle,
} from "@/components/SolarSystemScene";
import { getCelestialBody, PLANETS, SUN, type CelestialBody } from "@/content/space";
import { playTap } from "@/lib/sound";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { prefetch, speakSequence, stopSpeaking } from "@/lib/tts";

const MAIN_BODIES: CelestialBody[] = [SUN, ...PLANETS];
const FACT_TINTS = ["bg-blue-50", "bg-yellow-50", "bg-green-50"];
// The kiosk never scrolls, so the page needs a definite height instead of
// the stale `4rem` guess (which undercounted the chrome and let the page
// hang below the viewport, clipping the dock and pushing the scene's
// visual center down). 120px = TopBar (88px, see App.tsx) + App's pb-4 +
// breathing room — matches geography.tsx's PAGE_HEIGHT.
const PAGE_HEIGHT = "calc(100dvh - 200px)";

function speakBody(body: CelestialBody) {
  void speakSequence([
    { text: `${body.name}. ${body.facts.join(" ")}`, lang: "en" },
  ]);
}

export default function SpacePage() {
  const [, navigate] = useLocation();
  const sceneRef = useRef<SolarSystemHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedBody = selectedId ? getCelestialBody(selectedId) : null;

  // Warm every planet's narration line as soon as the page mounts, same as
  // the other narrated explorer pages (usa.tsx, science.tsx, etc.) — without
  // this the first tap on a cold kiosk may wait for optional narration
  // first-synthesis path with nothing playing while the child waits.
  useEffect(() => {
    void prefetch(
      MAIN_BODIES.map((body) => ({
        text: `${body.name}. ${body.facts.join(" ")}`,
        lang: "en" as const,
      })),
    );
  }, []);

  const chooseBody = useCallback((id: string | null) => {
    if (!id) {
      stopSpeaking();
      setSelectedId(null);
      return;
    }
    const body = getCelestialBody(id);
    if (!body) return;
    playTap();
    setSelectedId(id);
    speakBody(body);
  }, []);

  return (
    <div
      className="relative min-h-0 overflow-hidden bg-[#03040c]"
      style={{ height: PAGE_HEIGHT }}
    >
      <SolarSystemScene
        ref={sceneRef}
        bodies={PLANETS}
        star={SUN}
        selectedId={selectedId}
        onSelectBody={chooseBody}
        overviewDistance={21}
        className="absolute inset-0 z-0"
      />

      <button
        onClick={() => {
          stopSpeaking();
          navigate("/home");
        }}
        className="absolute left-4 top-4 z-30 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 shadow-lg"
        aria-label="Back to home"
      >
        <ArrowLeft size={32} className="text-slate-900" />
      </button>

      <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-indigo-200 drop-shadow">
          Astronomy
        </p>
        <h1 className="text-2xl font-black text-white drop-shadow">
          Our Solar System
        </h1>
      </div>

      <div className="absolute right-4 top-4 z-30 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 shadow-lg">
        <img
          src={ARTWORK(35)}
          alt="Clefairy, your Space guide"
          className="h-14 w-14 object-contain drop-shadow"
          onError={onSpriteError}
        />
      </div>

      <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-3">
        <button
          onClick={() => sceneRef.current?.zoomIn()}
          className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/90 shadow-lg"
          aria-label="Zoom in"
        >
          <Plus size={34} className="text-slate-900" />
        </button>
        <button
          onClick={() => sceneRef.current?.zoomOut()}
          className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/90 shadow-lg"
          aria-label="Zoom out"
        >
          <Minus size={34} className="text-slate-900" />
        </button>
      </div>

      <AnimatePresence>
        {selectedBody && (
          <motion.div
            key={selectedBody.id}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            className="absolute bottom-[144px] left-1/2 z-30 w-[min(600px,92vw)] -translate-x-1/2 overflow-hidden rounded-3xl bg-white/97 shadow-2xl backdrop-blur"
          >
            <div className="max-h-[38vh] overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black text-slate-900">
                  {selectedBody.name}
                </h2>
                <button
                  onClick={() => {
                    playTap();
                    speakBody(selectedBody);
                  }}
                  className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-pokemon-yellow text-pokemon-darkred shadow"
                  aria-label="Say it again"
                >
                  <Volume2 size={26} />
                </button>
              </div>

              <div className="space-y-3">
                {selectedBody.facts.map((fact, i) => (
                  <p
                    key={fact}
                    className={`rounded-2xl p-4 text-lg font-bold leading-snug text-slate-800 ${FACT_TINTS[i % FACT_TINTS.length]}`}
                  >
                    {fact}
                  </p>
                ))}
              </div>
            </div>

            <button
              onClick={() => sceneRef.current?.resetView()}
              className="flex min-h-[96px] w-full items-center justify-center gap-2 bg-slate-900 text-xl font-black text-white"
            >
              <ArrowLeft size={26} />
              Back to Space
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-[128px] bottom-4 z-30 overflow-hidden rounded-3xl bg-slate-900/80 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3 overflow-x-auto px-4 py-3">
          {MAIN_BODIES.map((body) => (
            <button
              key={body.id}
              onClick={() => chooseBody(body.id)}
              className={`flex h-[88px] min-w-[88px] flex-col items-center justify-center gap-1 rounded-2xl px-3 shadow-md transition ${
                selectedId === body.id
                  ? "bg-indigo-600 ring-4 ring-indigo-300"
                  : "bg-slate-700/90"
              }`}
              aria-label={`Show ${body.name}`}
            >
              <span
                className="h-7 w-7 rounded-full"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${body.colors[0]}, ${body.colors[2]})`,
                  boxShadow: `0 0 10px ${body.colors[0]}90`,
                }}
              />
              <span className="text-xs font-black leading-tight text-white">
                {body.name}
              </span>
            </button>
          ))}

          <button
            onClick={() => {
              playTap();
              navigate("/space/dwarfs");
            }}
            className="flex h-[88px] min-w-[136px] flex-col items-center justify-center gap-1 rounded-2xl bg-purple-600 px-4 shadow-md"
            aria-label="See the dwarf planets"
          >
            <Sparkles size={22} className="text-white" />
            <span className="text-xs font-black leading-tight text-white">
              Dwarf Planets
            </span>
          </button>

          <button
            onClick={() => {
              playTap();
              stopSpeaking();
              navigate("/rocket");
            }}
            className="flex h-[88px] min-w-[136px] flex-col items-center justify-center gap-1 rounded-2xl bg-orange-600 px-4 shadow-md"
            aria-label="Launch a rocket"
          >
            <Rocket size={22} className="text-white" />
            <span className="text-xs font-black leading-tight text-white">
              Rocket
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
