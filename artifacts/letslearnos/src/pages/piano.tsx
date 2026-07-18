// ---------------------------------------------------------------------------
// piano.tsx — Pokémon Piano module (route /piano)
//
// 8 huge rainbow keys spanning a C-major scale (C D E F G A B C), each keyed
// to a Pokémon that bounces on press. Two modes:
//   - Free Play (default): tap any key any time, just for fun.
//   - Play My Tune: the app plays a short note sequence with key highlights
//     (3 notes for the 3yo, 4-5 notes for the 5yo) and the child repeats it.
//     Any mistake just replays the tune with a gentle, encouraging nudge —
//     never a "wrong" sound or message. A completed tune logs one "piano"
//     attempt and immediately starts the next tune.
//
// Audio is a small local Web Audio synth (kept out of lib/sound.ts per the
// task's file-ownership boundary) so overlapping notes from two fingers just
// create two independent oscillator/gain nodes — no shared mutable state to
// collide on, so multi-touch can't crash playback.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, KeyboardMusic, Music, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, isMuted } from "@/lib/sound";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";

const SPRITE = ARTWORK;

// The kiosk never scrolls, so the page needs a definite height — the h-full
// chain collapses under App's min-h-screen wrapper (see match.tsx's note).
// 120px = TopBar padding (88) + App's pb-4 + breathing room.
const PAGE_HEIGHT = "calc(100vh - 200px)";

// ---------------------------------------------------------------------------
// Local synth — a tiny oscillator/gain envelope per note, independent of
// lib/sound.ts. A fresh AudioContext + nodes per call means two fingers
// pressing two keys at once just play two overlapping tones; nothing shared
// can throw.
// ---------------------------------------------------------------------------
let pianoCtx: AudioContext | null = null;

function getPianoAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!pianoCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    pianoCtx = new AC();
  }
  if (pianoCtx.state === "suspended") void pianoCtx.resume();
  return pianoCtx;
}

function playNote(freq: number) {
  if (isMuted()) return;
  const ac = getPianoAudioContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, ac.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.55);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.6);
}

// ---------------------------------------------------------------------------
// The 8 keys — a C-major scale, each paired with a kid-friendly Pokémon and
// a rainbow gradient. `textDark` marks the two pale/gold keys that need dark
// text for legibility (same convention as home.tsx's `gold` tile flag).
// ---------------------------------------------------------------------------
interface PianoKeyDef {
  note: string;
  name: string;
  freq: number;
  pokemonId: number;
  from: string;
  to: string;
  dark: string;
  textDark?: boolean;
}

const KEYS: PianoKeyDef[] = [
  { note: "C", name: "Charmander", freq: 261.63, pokemonId: 4, from: "#ff8a80", to: "#e53935", dark: "#b71c1c" },
  { note: "D", name: "Growlithe", freq: 293.66, pokemonId: 58, from: "#ffb74d", to: "#f4511e", dark: "#c43e00" },
  { note: "E", name: "Pikachu", freq: 329.63, pokemonId: 25, from: "#ffe066", to: "#f5b700", dark: "#c98e00", textDark: true },
  { note: "F", name: "Bulbasaur", freq: 349.23, pokemonId: 1, from: "#81e08a", to: "#3fa84a", dark: "#2c7a34" },
  { note: "G", name: "Squirtle", freq: 392.0, pokemonId: 7, from: "#6fd8ff", to: "#2196c9", dark: "#12729e" },
  { note: "A", name: "Gastly", freq: 440.0, pokemonId: 92, from: "#b39cff", to: "#7e57c2", dark: "#5e3ba3" },
  { note: "B", name: "Jigglypuff", freq: 493.88, pokemonId: 39, from: "#ff9fd1", to: "#e0529b", dark: "#b8317a" },
  { note: "C", name: "Togepi", freq: 523.25, pokemonId: 175, from: "#fff2a8", to: "#ffd54f", dark: "#d4a017", textDark: true },
];

export default function PianoPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();
  const is3yo = (profile?.age ?? 5) <= 3;

  // Mode + "Play My Tune" state
  const [mode, setMode] = useState<"free" | "tune">("free");
  const [phase, setPhase] = useState<"listening" | "waiting">("listening");
  const [tune, setTune] = useState<number[]>([]);
  const [childIndex, setChildIndex] = useState(0);
  const [tunesCompleted, setTunesCompleted] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Visual key state
  const [pressedSet, setPressedSet] = useState<Set<number>>(new Set());
  const [bounceCounts, setBounceCounts] = useState<number[]>(() => KEYS.map(() => 0));
  const [wiggleIdx, setWiggleIdx] = useState<number | null>(null);

  // Refs mirror the fast-moving game logic so async sequences never read
  // stale state, and every pending timeout is tracked so it can be cleared
  // on unmount or on a mode switch (prevents late setState after leaving).
  const locked = useRef(false);
  const childIndexRef = useRef(0);
  const tuneRoundRef = useRef(1);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    void prefetch([
      { text: "Listen!", lang: "en" },
      { text: "Your turn!", lang: "en" },
      { text: "Let's listen again! You can do it!", lang: "en" },
    ]);
    return () => {
      stopSpeaking();
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const id = window.setTimeout(resolve, ms);
      timeoutsRef.current.push(id);
    });
  }

  // Press a key: plays the note, bounces its Pokémon, and depresses the key
  // — used for both real taps and the app's own tune playback so "listening"
  // highlights look identical to a real press.
  function pressKey(i: number) {
    const key = KEYS[i];
    playNote(key.freq);
    setBounceCounts((prev) => {
      const next = [...prev];
      next[i] += 1;
      return next;
    });
    setPressedSet((prev) => new Set(prev).add(i));
    const id = window.setTimeout(() => {
      setPressedSet((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    }, 180);
    timeoutsRef.current.push(id);
  }

  function randomTuneLength(): number {
    if (is3yo) return 3;
    return Math.random() < 0.5 ? 4 : 5;
  }

  function genTune(length: number): number[] {
    const seq: number[] = [];
    let last = -1;
    for (let i = 0; i < length; i++) {
      let idx = Math.floor(Math.random() * KEYS.length);
      while (idx === last) idx = Math.floor(Math.random() * KEYS.length);
      seq.push(idx);
      last = idx;
    }
    return seq;
  }

  async function playTuneSequence(seq: number[]) {
    locked.current = true;
    setPhase("listening");
    childIndexRef.current = 0;
    setChildIndex(0);
    await wait(500);
    for (let i = 0; i < seq.length; i++) {
      pressKey(seq[i]);
      await wait(650);
    }
    setPhase("waiting");
    locked.current = false;
    void speakText("Your turn!", "en");
  }

  function startNextTune() {
    tuneRoundRef.current += 1;
    const seq = genTune(randomTuneLength());
    setTune(seq);
    void playTuneSequence(seq);
  }

  function completeTune() {
    locked.current = true;
    playCorrect();
    setTunesCompleted((c) => c + 1);
    void logAttempt("piano", `tune-${tuneRoundRef.current}`, true);
    setShowConfetti(true);
    const id1 = window.setTimeout(() => setShowConfetti(false), 1600);
    timeoutsRef.current.push(id1);
    const id2 = window.setTimeout(() => startNextTune(), 1800);
    timeoutsRef.current.push(id2);
  }

  // Positive-only retry: no wrong sound, just a warm nudge and a replay.
  function retryTune() {
    locked.current = true;
    void speakText("Let's listen again! You can do it!", "en");
    const id = window.setTimeout(() => {
      void playTuneSequence(tune);
    }, 1100);
    timeoutsRef.current.push(id);
  }

  function handleTuneTap(i: number) {
    const expected = tune[childIndexRef.current];
    if (i === expected) {
      childIndexRef.current += 1;
      setChildIndex(childIndexRef.current);
      if (childIndexRef.current >= tune.length) {
        completeTune();
      }
    } else {
      setWiggleIdx(i);
      const wid = window.setTimeout(() => setWiggleIdx(null), 400);
      timeoutsRef.current.push(wid);
      childIndexRef.current = 0;
      setChildIndex(0);
      retryTune();
    }
  }

  function handleKeyPress(i: number) {
    pressKey(i);
    if (mode === "tune" && phase === "waiting" && !locked.current) {
      handleTuneTap(i);
    }
  }

  function handleToggleMode() {
    playTap();
    if (mode === "free") {
      setMode("tune");
      tuneRoundRef.current = 1;
      setTunesCompleted(0);
      const seq = genTune(randomTuneLength());
      setTune(seq);
      void playTuneSequence(seq);
    } else {
      setMode("free");
      locked.current = false;
      stopSpeaking();
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
      setTune([]);
      childIndexRef.current = 0;
      setChildIndex(0);
      setPhase("listening");
      setShowConfetti(false);
    }
  }

  const subtitle =
    mode === "free"
      ? "Tap the keys and make music!"
      : phase === "listening"
        ? "Listen closely..."
        : `Your turn! Tap what you heard (${childIndex}/${tune.length})`;

  return (
    <div
      className="flex flex-col px-4 py-4 gap-3 relative overflow-hidden"
      style={{ height: PAGE_HEIGHT }}
    >
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
          <h1 className="text-3xl font-black text-pokemon-blue leading-tight flex items-center gap-2">
            <Music size={30} className="shrink-0" />
            Pokémon Piano
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">{subtitle}</p>
          {mode === "tune" && (
            <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
              <motion.div
                className="bg-pokemon-blue h-3 rounded-full"
                animate={{ width: `${(childIndex / Math.max(tune.length, 1)) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>

        {mode === "tune" && (
          <div className="hidden md:flex items-center gap-2 bg-white rounded-2xl px-5 min-h-[88px] shadow shrink-0">
            <Star size={30} className="text-pokemon-yellow fill-pokemon-yellow" />
            <span className="text-2xl font-black text-gray-700">{tunesCompleted}</span>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={handleToggleMode}
          className={`shrink-0 flex items-center gap-2 min-h-[88px] px-6 rounded-3xl text-xl font-black shadow-lg ${
            mode === "tune" ? "bg-gray-200 text-gray-700" : "bg-pokemon-blue text-white"
          }`}
        >
          <KeyboardMusic size={28} />
          {mode === "tune" ? "Free Play" : "Play My Tune"}
        </motion.button>
      </div>

      {/* Confetti — positive-only celebration on each completed tune */}
      <AnimatePresence>
        {showConfetti &&
          Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: "-5vh", x: (i - 7) * 60 }}
              animate={{
                opacity: [0, 1, 0],
                // Percentage y transforms in framer-motion resolve against the
                // element's own box (a ~48px star), not the page, so the old
                // "-10%"→"110%" keyframes only moved ~55px. Viewport units
                // make the stars actually rain down across the key area.
                y: ["-5vh", "90vh"],
                rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
              }}
              transition={{ duration: 1.6, delay: i * 0.06, ease: "easeIn" }}
              className="absolute text-5xl pointer-events-none select-none z-30"
              style={{ left: `${(i / 13) * 90 + 5}%`, top: 0 }}
              aria-hidden="true"
            >
              ★
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Keys */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="w-full h-full max-w-[1800px] mx-auto bg-white/40 rounded-[40px] p-4 shadow-inner">
          <div className="flex gap-3 md:gap-4 w-full h-full">
            {KEYS.map((key, i) => {
              const pressed = pressedSet.has(i);
              const wiggling = wiggleIdx === i;
              return (
                <motion.button
                  key={`${key.note}-${i}`}
                  onPointerDown={() => handleKeyPress(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleKeyPress(i);
                    }
                  }}
                  aria-label={`${key.note} key — ${key.name}`}
                  style={{
                    background: `linear-gradient(160deg, ${key.from}, ${key.to})`,
                    boxShadow: `0 ${pressed ? 3 : 8}px 0 ${key.dark}`,
                    touchAction: "none",
                    minWidth: 120,
                  }}
                  animate={
                    wiggling
                      ? { x: [0, -8, 8, -6, 6, 0], y: pressed ? 8 : 0, scale: pressed ? 0.96 : 1 }
                      : { x: 0, y: pressed ? 8 : 0, scale: pressed ? 0.96 : 1 }
                  }
                  transition={wiggling ? { duration: 0.4 } : { duration: 0.12 }}
                  className="flex-1 rounded-3xl flex flex-col items-center justify-between py-4 relative select-none focus:outline-none focus:ring-4 focus:ring-white"
                >
                  <motion.img
                    key={bounceCounts[i]}
                    src={SPRITE(key.pokemonId)}
                    onError={onSpriteError}
                    alt=""
                    initial={{ y: 0, scale: 1 }}
                    animate={{ y: [0, -22, 0], scale: [1, 1.16, 1] }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 object-contain drop-shadow-lg pointer-events-none"
                    draggable={false}
                  />
                  <span
                    className={`text-4xl md:text-5xl font-black drop-shadow ${
                      key.textDark ? "text-amber-900" : "text-white"
                    }`}
                  >
                    {key.note}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
