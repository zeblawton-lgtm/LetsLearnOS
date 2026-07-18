// USA explorer — /usa
// A clickable map of the 50 states. Explore: tap any state to hear its name
// and a fun fact (works for the pre-reader — everything is narrated). Find
// It! (5yo only): "Can you find Texas?" — wrong taps get a friendly "That's
// California" redirect, never a buzzer. Positive feedback only.

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, speakSequence, stopSpeaking, prefetch } from "@/lib/tts";
import { STATE_PATHS, MAP_VIEWBOX } from "@/content/usa-map";
import { STATE_FACTS, SMALL_STATES } from "@/content/usa";

const NAME_MAP = new Map(STATE_PATHS.map((s) => [s.id, s.name]));

function stateName(id: string): string {
  return NAME_MAP.get(id) ?? id;
}

const FIND_GOAL = 8;

function randomTarget(exclude: Set<string>): string {
  const pool = STATE_PATHS.filter((s) => !exclude.has(s.id));
  return pool[Math.floor(Math.random() * pool.length)].id;
}

type Mode = "explore" | "find";

export default function UsaPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;

  const [mode, setMode] = useState<Mode>("explore");
  const [selected, setSelected] = useState<string | null>(null);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  // Find It! state
  const [target, setTarget] = useState<string | null>(null);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const wrongTimer = useRef<number | null>(null);

  useEffect(() => {
    void prefetch([{ text: "This is the United States! Tap a state to explore.", lang: "en" }]);
    void speakText("This is the United States! Tap a state to explore.", "en");
    return () => {
      stopSpeaking();
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    };
  }, []);

  const startFind = useCallback(() => {
    stopSpeaking();
    stopMusic();
    setMode("find");
    setSelected(null);
    setFound(new Set());
    setDone(false);
    const first = randomTarget(new Set());
    setTarget(first);
    void speakText(`Can you find ${stateName(first)}?`, "en");
  }, []);

  const startExplore = useCallback(() => {
    stopSpeaking();
    setMode("explore");
    setTarget(null);
    setDone(false);
  }, []);

  const nextTarget = useCallback((newFound: Set<string>) => {
    const next = randomTarget(newFound);
    setTarget(next);
    void speakText(`Can you find ${stateName(next)}?`, "en");
  }, []);

  const handleStateTap = useCallback(
    (id: string) => {
      if (done) return;

      if (mode === "explore") {
        playTap();
        setSelected(id);
        setVisited((prev) => new Set([...prev, id]));
        const f = STATE_FACTS[id];
        void speakSequence([
          { text: `${stateName(id)}!`, lang: "en" },
          ...(f
            ? [
                { text: f.fact, lang: "en" as const },
                { text: `The capital is ${f.capital}.`, lang: "en" as const },
              ]
            : []),
        ]);
        return;
      }

      // Find It! mode
      if (!target) return;
      if (found.has(id)) return; // already-found states are done — ignore

      if (id === target) {
        playCorrect();
        setSelected(id);
        const newFound = new Set([...found, id]);
        setFound(newFound);
        void logAttempt("usa", `find-${id}`, true);

        if (newFound.size >= FIND_GOAL) {
          setTarget(null);
          void speakText(`You found ${stateName(id)}!`, "en");
          setTimeout(() => {
            playFanfare();
            playJingle();
            setDone(true);
          }, 700);
        } else {
          void (async () => {
            await speakText(`You found ${stateName(id)}!`, "en");
            nextTarget(newFound);
          })();
        }
      } else {
        // Friendly redirect — name what they tapped, repeat the goal. No
        // buzzer, no red: this is how a grown-up would answer at a real map.
        playTap();
        setWrongPick(id);
        if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
        wrongTimer.current = window.setTimeout(() => setWrongPick(null), 1100);
        void logAttempt("usa", `find-${target}`, false);
        void speakSequence([
          { text: `That's ${stateName(id)}.`, lang: "en" },
          { text: `Can you find ${stateName(target)}?`, lang: "en" },
        ]);
      }
    },
    [mode, target, found, done, nextTarget, logAttempt]
  );

  const fillFor = (id: string): string => {
    if (mode === "find") {
      if (found.has(id)) return "#7ccf6e";
      if (wrongPick === id) return "#ffd76a";
      return "#a8d8a0";
    }
    if (selected === id) return "#ffb340";
    if (visited.has(id)) return "#ffe08a";
    return "#a8d8a0";
  };

  // The kiosk never scrolls, so the page needs a definite height — the h-full
  // chain collapses under App's min-h-screen wrapper (see match.tsx's note).
  // 120px = TopBar padding (88) + App's pb-4 + breathing room.
  const PAGE_HEIGHT = "calc(100vh - 200px)";

  // ── Completion screen (Find It!) ──────────────────────────────────────────
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
          <div className="text-8xl">🗺️</div>
          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">
            You found them all!
          </h2>
          <p className="text-3xl font-bold text-gray-600">
            {FIND_GOAL} states — you're a super explorer!
          </p>

          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {Array.from({ length: FIND_GOAL }).map((_, i) => (
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
              onClick={startFind}
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

  const selectedFact = selected ? STATE_FACTS[selected] : null;

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col px-4 pt-2 gap-3" style={{ height: PAGE_HEIGHT }}>
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
            United States
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            {mode === "explore"
              ? `States visited: ${visited.size} / ${STATE_PATHS.length}`
              : `Found: ${found.size} / ${FIND_GOAL}`}
          </p>
        </div>

        {/* Mode toggle — reading-dependent game, so 5yo only */}
        {!is3yo && (
          <button
            onClick={() => (mode === "explore" ? startFind() : startExplore())}
            className={`min-h-[88px] px-8 rounded-2xl text-2xl font-black shrink-0 ${
              mode === "find"
                ? "bg-pokemon-blue text-white"
                : "bg-pokemon-yellow text-amber-900"
            }`}
            style={{ boxShadow: "0 5px 0 rgba(0,0,0,0.15)" }}
          >
            {mode === "explore" ? "🔍 Find It!" : "🖐 Explore"}
          </button>
        )}
      </div>

      {/* Map + small-state buttons */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div
          className="flex-1 min-w-0 rounded-3xl flex items-center justify-center p-4"
          style={{ background: "linear-gradient(180deg,#bfe6ff 0%,#9fd6f7 100%)" }}
        >
          <svg
            viewBox={MAP_VIEWBOX}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            role="group"
            aria-label="Map of the United States"
          >
            {STATE_PATHS.map((s) => (
              <path
                key={s.id}
                d={s.d}
                fill={fillFor(s.id)}
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeLinejoin="round"
                onClick={() => handleStateTap(s.id)}
                style={{ cursor: "pointer", transition: "fill 200ms ease" }}
                aria-label={s.name}
              />
            ))}
          </svg>
        </div>

        {/* Tiny Northeast states as honest-sized buttons */}
        <div className="grid grid-cols-2 gap-2 self-center shrink-0">
          {SMALL_STATES.map((id) => (
            <motion.button
              key={id}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleStateTap(id)}
              className="min-h-[88px] w-[170px] rounded-2xl bg-white flex flex-col items-center justify-center px-2"
              style={{
                boxShadow: "0 4px 0 rgba(0,0,0,0.1)",
                outline:
                  selected === id || (mode === "find" && found.has(id))
                    ? "4px solid #ffb340"
                    : "none",
              }}
            >
              <span className="text-3xl font-black text-pokemon-blue">{id}</span>
              <span className="text-sm font-bold text-gray-600 leading-tight">
                {stateName(id)}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom card — always present so the map never resizes and nothing
          ends up below the fold (the kiosk cannot scroll). Carries the tap
          prompt, the selected state's fact, or the Find It! challenge. */}
      <div className="shrink-0 min-h-[136px] pb-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${mode === "find" ? target ?? "done" : selected ?? "none"}`}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="bg-white rounded-3xl px-8 py-4 flex items-center gap-6 min-h-[128px]"
            style={{ boxShadow: "0 6px 0 rgba(0,0,0,0.1)" }}
          >
            {mode === "find" ? (
              <>
                <span className="text-6xl shrink-0" aria-hidden>🔍</span>
                <div className="text-4xl font-black text-gray-800 leading-tight">
                  {target ? `Can you find ${stateName(target)}?` : "Great job!"}
                </div>
              </>
            ) : selected ? (
              <>
                <span className="text-6xl shrink-0" aria-hidden>
                  {selectedFact?.emoji ?? "⭐"}
                </span>
                <div className="min-w-0">
                  <div className="text-4xl font-black text-gray-800 leading-tight">
                    {stateName(selected)}
                  </div>
                  {selectedFact && (
                    <p className="text-2xl font-bold text-gray-500 mt-1">
                      {selectedFact.fact}{" "}
                      <span className="text-pokemon-blue">
                        ⭐ Capital: {selectedFact.capital}
                      </span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="text-6xl shrink-0" aria-hidden>🗺️</span>
                <div className="min-w-0">
                  <div className="text-4xl font-black text-gray-800 leading-tight">
                    Tap a state to explore!
                  </div>
                  <p className="text-2xl font-bold text-gray-500 mt-1">
                    Hear its name and a fun fact.
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
