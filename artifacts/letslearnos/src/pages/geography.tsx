import { motion } from "framer-motion";
import { ArrowLeft, ChevronsLeft, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { EarthScene, type EarthHandle } from "@/components/EarthScene";
import { continents, type ContinentFact } from "@/content/world-globe";
import { playTap } from "@/lib/sound";
import { prefetch, speakText, stopSpeaking } from "@/lib/tts";

// The kiosk never scrolls, so the page needs a definite height — the h-full
// chain collapses under App's min-h-screen wrapper (see match.tsx's note).
// 120px = TopBar padding (88) + App's pb-4 + breathing room.
const PAGE_HEIGHT = "calc(100vh - 200px)";

interface PanelSize {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sayText(text: string) {
  void speakText(text, "en");
}

function sayContinent(continent: ContinentFact) {
  sayText(`${continent.name}. ${continent.fact}`);
}

function sayCountry(country: ContinentFact["countries"][number]) {
  sayText(`${country.name}. Capital: ${country.capital}. ${country.fact}`);
}

function sayRegion(
  region: ContinentFact["countries"][number]["regions"][number],
) {
  sayText(`${region.name}. ${region.fact}`);
}

export default function GeographyPage() {
  const [, navigate] = useLocation();
  const sceneRef = useRef<EarthHandle>(null);
  const [selectedId, setSelectedId] = useState("north-america");
  const [selectedCountryName, setSelectedCountryName] =
    useState("United States");
  const [globeError, setGlobeError] = useState<string | null>(null);
  const [panelSize, setPanelSize] = useState<PanelSize>({
    width: 460,
    height: 620,
  });
  const resizeStart = useRef<(PanelSize & { x: number; y: number }) | null>(
    null,
  );

  const selectedContinent =
    continents.find((continent) => continent.id === selectedId) ??
    continents[0];
  const selectedCountry =
    selectedContinent.countries.find(
      (country) => country.name === selectedCountryName,
    ) ?? selectedContinent.countries[0];

  useEffect(() => {
    if (
      !selectedContinent.countries.some(
        (country) => country.name === selectedCountryName,
      )
    ) {
      setSelectedCountryName(selectedContinent.countries[0].name);
    }
  }, [selectedContinent, selectedCountryName]);

  useEffect(() => () => stopSpeaking(), []);

  // Warm every continent's narration line as soon as the page mounts, same
  // as the other narrated explorer pages (usa.tsx, science.tsx, etc.) —
  // without this the first tap on a cold kiosk may wait for optional narration
  // up-to-2-minute first-synthesis path with nothing playing while the
  // child waits.
  useEffect(() => {
    void prefetch(
      continents.map((continent) => ({
        text: `${continent.name}. ${continent.fact}`,
        lang: "en" as const,
      })),
    );
  }, []);

  // Warm the selected continent's country + region lines too, so drilling
  // into a continent's countries/regions is instant even before the
  // Say-It-Again buttons are tapped.
  useEffect(() => {
    const parts = selectedContinent.countries.flatMap((country) => [
      {
        text: `${country.name}. Capital: ${country.capital}. ${country.fact}`,
        lang: "en" as const,
      },
      ...country.regions.map((region) => ({
        text: `${region.name}. ${region.fact}`,
        lang: "en" as const,
      })),
    ]);
    void prefetch(parts);
  }, [selectedContinent]);

  // The fallback card must be narrated too — a pre-reader can't read why the
  // globe went away or that the fact panel still works.
  useEffect(() => {
    if (globeError) {
      sayText(
        "The spinning globe is resting right now. You can still tap the buttons to hear all about the world.",
      );
    }
  }, [globeError]);

  // Single entry point for picking a continent — the 3D tap (EarthScene's
  // onSelectContinent) and the picker row below both call this, so the tap
  // sound and narration only ever fire once per selection (same discipline
  // as space.tsx's chooseBody).
  const chooseContinent = (id: string) => {
    const continent = continents.find((c) => c.id === id);
    if (!continent) return;
    playTap();
    setSelectedId(id);
    setSelectedCountryName(continent.countries[0].name);
    sayContinent(continent);
  };

  // Pointer capture keeps the drag on the handle itself — no window
  // listeners to leak if the page unmounts mid-drag.
  const beginResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      x: event.clientX,
      y: event.clientY,
      width: panelSize.width,
      height: panelSize.height,
    };
  };

  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const from = resizeStart.current;
    if (!from) return;
    setPanelSize({
      width: clamp(from.width + from.x - event.clientX, 320, 620),
      height: clamp(from.height + from.y - event.clientY, 280, 620),
    });
  };

  const endResize = () => {
    resizeStart.current = null;
  };

  return (
    <div
      className="relative min-h-0 overflow-hidden bg-[#03040c]"
      style={{ height: PAGE_HEIGHT }}
    >
      {/* Full-bleed stage: zooming in must never clip the sphere against a
          square stage edge. Real coastlines, starfield backdrop, and an
          atmosphere glow — the Earth-sized sibling of the Space page's
          SolarSystemScene. */}
      <EarthScene
        ref={sceneRef}
        selectedId={selectedId}
        onSelectContinent={chooseContinent}
        onError={setGlobeError}
        className="absolute inset-0 z-0"
      />

      <button
        onClick={() => navigate("/home")}
        className="absolute left-4 top-4 z-20 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 shadow-lg"
        aria-label="Back"
      >
        <ArrowLeft size={40} />
      </button>

      {/* Zoom controls — pinch works too, but little fingers get buttons. */}
      <div className="absolute bottom-5 left-4 z-20 flex flex-col gap-3">
        <button
          onClick={() => {
            playTap();
            sceneRef.current?.zoomIn();
          }}
          className="flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 text-5xl font-black text-slate-700 shadow-lg"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            playTap();
            sceneRef.current?.zoomOut();
          }}
          className="flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 text-5xl font-black text-slate-700 shadow-lg"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* EarthScene renders its own fallback card (matching
          SolarSystemScene's) when it can't start or loses its WebGL
          context; globeError here just drives the narration above. */}

      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-5 right-5 z-20 overflow-hidden rounded-3xl bg-white/95 shadow-2xl backdrop-blur"
        style={{
          width: panelSize.width,
          height: panelSize.height,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100% - 40px)",
        }}
      >
        <button
          onPointerDown={beginResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className="absolute left-0 top-0 z-10 flex h-[88px] w-[88px] touch-none items-center justify-center rounded-br-2xl bg-slate-100 text-slate-600"
          aria-label="Resize panel"
        >
          <ChevronsLeft size={32} />
        </button>

        <div className="h-full overflow-y-auto p-5">
          {/* pl clears the 88px resize handle; the rows below start beneath
              it and keep the full panel width. */}
          <div className="mb-4 flex min-h-[88px] items-start justify-between gap-3 pl-[76px]">
            <div>
              <p className="text-base font-black text-slate-500">
                Globe Explorer
              </p>
              <h1 className="text-3xl font-black leading-tight text-slate-900">
                {selectedContinent.name}
              </h1>
            </div>
            <button
              onClick={() => {
                playTap();
                sayContinent(selectedContinent);
              }}
              className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-pokemon-yellow text-pokemon-darkred shadow"
              aria-label="Say continent fact"
            >
              <Volume2 size={36} />
            </button>
          </div>

          {/* Guaranteed path to every continent — tapping the 3D globe does
              the same thing, but this row always works even if WebGL
              doesn't start. */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {continents.map((continent) => {
              const active = continent.id === selectedContinent.id;
              return (
                <button
                  key={continent.id}
                  onClick={() => chooseContinent(continent.id)}
                  className="flex min-h-[88px] min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-center text-sm font-black leading-tight shadow-sm transition"
                  style={{
                    backgroundColor: active ? continent.color : "#f1f5f9",
                    color: active ? "#ffffff" : "#334155",
                  }}
                  aria-label={`Show ${continent.name}`}
                >
                  {continent.markerLabel.split("\n").map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>

          <p className="mb-4 rounded-2xl bg-sky-50 p-3 text-lg font-bold leading-snug text-slate-700">
            {selectedContinent.fact}
          </p>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {selectedContinent.countries.map((country) => (
              <button
                key={country.name}
                onClick={() => {
                  playTap();
                  setSelectedCountryName(country.name);
                  sayCountry(country);
                }}
                className={`min-h-[88px] min-w-[88px] shrink-0 rounded-2xl px-4 text-base font-black shadow-sm ${
                  country.name === selectedCountry.name
                    ? "bg-green-500 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {country.name}
              </button>
            ))}
          </div>

          <section className="rounded-3xl bg-green-50 p-4">
            <p className="text-sm font-black uppercase tracking-wide text-green-700">
              {selectedCountry.name}
            </p>
            <h2 className="text-2xl font-black text-slate-900">
              Capital: {selectedCountry.capital}
            </h2>
            <p className="mt-2 text-lg font-bold leading-snug text-slate-700">
              {selectedCountry.fact}
            </p>
          </section>

          <section className="mt-4">
            <p className="mb-2 text-lg font-black text-slate-800">
              {selectedCountry.regionsLabel}
            </p>
            <div className="grid gap-2">
              {selectedCountry.regions.map((region) => (
                <button
                  key={region.name}
                  onClick={() => {
                    playTap();
                    sayRegion(region);
                  }}
                  className="min-h-[88px] rounded-2xl bg-white p-3 text-left shadow-sm ring-2 ring-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-black text-slate-900">
                      {region.name}
                    </p>
                    <Volume2
                      size={22}
                      className="mt-1 shrink-0 text-green-600"
                    />
                  </div>
                  <p className="text-base font-bold leading-snug text-slate-600">
                    {region.fact}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </motion.aside>
    </div>
  );
}
