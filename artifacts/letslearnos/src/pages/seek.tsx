// ---------------------------------------------------------------------------
// seek.tsx — Hide & Seek module (route /seek), ADR-020 "Where's Waldo" build.
//
// A session steps through the richly illustrated crowd scenes in
// src/content/waldo-scenes.ts, rendered by src/components/WaldoScene.tsx.
// Each scene is a wide picture packed with ~20 Pokémon; the target strip at
// the top shows the 3-5 specific Pokémon to find, and the child drags to
// pan across the picture hunting for them. Positive feedback only: tapping
// a target counts it (pop + name spoken), tapping anyone else just makes
// them wiggle hello — there is no "wrong" tap in this game.
//
// This page owns ALL of the session state (found set, hint, per-scene
// progress, narration, logAttempt); WaldoScene owns only pan/tap mechanics
// and the decoy wiggle.
//
// Ages: 3yo plays the first 3 (gentler) scenes and only 3 targets each;
// 5yo plays all 5 scenes with the full target list (5 in the finale).
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star, Sparkles } from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, speakSequence, stopSpeaking, prefetch } from "@/lib/tts";
import { useSession } from "@/context/SessionContext";
import {
  waldoScenes,
  pokemonName,
  foundSpokenLine,
  findPromptLine,
  allSeekSpokenLines,
  SEEK_DONE_LINE,
  SEEK_SESSION_DONE_LINE,
} from "@/content/waldo-scenes";
import { WaldoScene } from "@/components/WaldoScene";

const SPRITE = ARTWORK;

// The kiosk never scrolls, so the page needs a definite height — 120px =
// TopBar padding (88) + App's pb-4 + breathing room. Matches
// geography.tsx/science.tsx's PAGE_HEIGHT.
const PAGE_HEIGHT = "calc(100vh - 200px)";

// The mascot used for the session-complete celebration — Ditto fits the
// "hide" theme (it disguises itself) and isn't used as any home-tile mascot.
const CELEBRATION_ID = 132;

export default function SeekPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;

  // 3yo plays the first 3 (gentler) scenes; 5yo plays the full set of 5.
  const sessionScenes = useMemo(() => (is3yo ? waldoScenes.slice(0, 3) : waldoScenes), [is3yo]);

  const [sceneIdx, setSceneIdx] = useState(0);
  const [done, setDone] = useState(false);

  const [found, setFound] = useState<Set<number>>(new Set());
  const [justFoundId, setJustFoundId] = useState<number | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const [allFound, setAllFound] = useState(false);

  const scene = sessionScenes[sceneIdx];

  // The Pokémon this child is asked to find; 3yo gets a trimmed list so a
  // scene never asks a toddler for more than 3 finds.
  const targets = useMemo(() => {
    const all = scene.pokemon.filter((p) => p.target);
    return is3yo ? all.slice(0, 3) : all;
  }, [scene, is3yo]);
  const targetIds = useMemo(() => new Set(targets.map((t) => t.id)), [targets]);
  const total = targets.length;

  // Prefetch every phrase this page can speak (same strings warm-tts warms).
  useEffect(() => {
    void prefetch(allSeekSpokenLines().map((text) => ({ text, lang: "en" as const })));
    return () => stopSpeaking();
  }, []);

  // Reset + announce whenever a new scene loads.
  useEffect(() => {
    setFound(new Set());
    setJustFoundId(null);
    setHintId(null);
    setAllFound(false);
    void speakSequence([
      { text: scene.intro, lang: "en" },
      { text: findPromptLine(total), lang: "en" },
    ]);
  }, [scene, is3yo, total]);

  const handleTapPokemon = useCallback(
    (id: number) => {
      if (allFound) return;
      if (!targetIds.has(id) || found.has(id)) {
        // A decoy (or an already-found target): friendly tap sound, the
        // sprite wiggles in WaldoScene — never a "wrong" cue.
        playTap();
        return;
      }
      playCorrect();
      const next = new Set(found);
      next.add(id);
      setFound(next);
      setJustFoundId(id);
      setTimeout(() => setJustFoundId((cur) => (cur === id ? null : cur)), 600);

      if (next.size >= total) {
        setAllFound(true);
        void speakSequence([
          { text: foundSpokenLine(id), lang: "en" },
          { text: SEEK_DONE_LINE, lang: "en" },
        ]);
        void logAttempt("seek", `waldo-scene-${scene.id}`, true);
      } else {
        void speakText(foundSpokenLine(id), "en");
      }
    },
    [found, allFound, targetIds, total, scene.id, logAttempt],
  );

  const handleHint = useCallback(() => {
    playTap();
    const remaining = targets.filter((t) => !found.has(t.id));
    if (remaining.length === 0) return;
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    setHintId(pick.id);
    setTimeout(() => setHintId((cur) => (cur === pick.id ? null : cur)), 1600);
  }, [targets, found]);

  const handleSceneComplete = useCallback(() => {
    if (sceneIdx + 1 >= sessionScenes.length) {
      stopSpeaking();
      playFanfare();
      playJingle();
      void speakText(SEEK_SESSION_DONE_LINE, "en");
      setDone(true);
    } else {
      setSceneIdx((i) => i + 1);
    }
  }, [sceneIdx, sessionScenes.length]);

  const startNewGame = useCallback(() => {
    stopSpeaking();
    stopMusic();
    setSceneIdx(0);
    setDone(false);
  }, []);

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.img
            src={SPRITE(CELEBRATION_ID)}
            onError={onSpriteError}
            alt="Ditto"
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">Amazing seeking!</h2>
          <p className="text-3xl font-bold text-gray-600">You found every single one, {profile?.name ?? "friend"}!</p>

          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {Array.from({ length: sessionScenes.length }).map((_, i) => (
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
              onClick={startNewGame}
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

  return (
    <div className="relative min-h-0 overflow-hidden bg-[#bfe3ff]" style={{ height: PAGE_HEIGHT }}>
      <WaldoScene
        scene={scene}
        activeTargetIds={targetIds}
        found={found}
        justFoundId={justFoundId}
        hintId={hintId}
        onTapPokemon={handleTapPokemon}
        className="absolute inset-0 z-0 h-full"
      />

      <button
        onClick={() => {
          stopSpeaking();
          navigate("/home");
        }}
        aria-label="Back to Home"
        className="absolute left-4 top-4 z-30 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-white/95 shadow-lg"
      >
        <ArrowLeft size={40} />
      </button>

      {/* Target strip — the "Where's Waldo" checklist. pointer-events-none so
          a mis-aimed tap falls through to the picture instead of dying on
          the card. */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
        <div className="flex items-center gap-4 rounded-3xl bg-white/90 px-6 py-3 shadow-lg backdrop-blur">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-wide text-slate-600">Can you find…</p>
            <p className="text-lg font-black text-slate-900">
              Scene {sceneIdx + 1} of {sessionScenes.length}
            </p>
          </div>
          <div className="flex gap-3">
            {targets.map((t) => {
              const isFound = found.has(t.id);
              return (
                <div key={t.id} className="relative flex flex-col items-center w-20">
                  <div
                    className={`relative h-16 w-16 rounded-2xl border-4 p-1 transition-colors ${
                      isFound ? "border-pokemon-yellow bg-yellow-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <img
                      src={SPRITE(t.id)}
                      onError={onSpriteError}
                      alt={pokemonName(t.id)}
                      className={`h-full w-full object-contain ${isFound ? "" : "opacity-90"}`}
                    />
                    {isFound && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 14 }}
                        className="absolute -right-3 -top-3"
                      >
                        <Star size={28} className="text-pokemon-yellow fill-pokemon-yellow drop-shadow" />
                      </motion.span>
                    )}
                  </div>
                  <p className="mt-0.5 w-full truncate text-center text-xs font-black text-slate-700">
                    {pokemonName(t.id)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-20 rounded-2xl bg-white/95 px-5 py-3 shadow-lg" role="status">
        <p className="text-xl font-black text-gray-700">
          {found.size} / {total} found
        </p>
      </div>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleHint}
        aria-label="Hint: show one hidden Pokémon"
        className="absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-2xl border-4 border-pokemon-yellow bg-white/95 px-6 shadow-lg min-h-[88px] active:bg-yellow-50"
      >
        <Sparkles className="text-pokemon-yellow" size={30} />
        <span className="text-xl font-black text-gray-700">Hint</span>
      </motion.button>

      <AnimatePresence>
        {allFound && (
          <motion.div
            key="scene-done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-black/25 backdrop-blur-sm"
          >
            <div className="flex gap-1.5 flex-wrap justify-center max-w-md">
              {Array.from({ length: total }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 300 }}
                >
                  <Star size={40} className="text-pokemon-yellow fill-pokemon-yellow drop-shadow" />
                </motion.div>
              ))}
            </div>
            <p className="text-4xl font-black text-white drop-shadow-lg text-center px-4">{SEEK_DONE_LINE}</p>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={handleSceneComplete}
              className="bg-pokemon-blue text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-xl min-h-[88px] min-w-[220px]"
            >
              {sceneIdx + 1 < sessionScenes.length ? "Next Scene →" : "Finish"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
