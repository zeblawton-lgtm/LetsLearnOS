// ---------------------------------------------------------------------------
// search.tsx — Hidden Search module (route /search, ADR-021).
//
// Where's-Waldo mode with generated pages: ONE target Pokémon hidden in a
// dense illustrated crowd (content/waldo_pages -> search-pages.gen.ts). The
// child pans the wide picture hunting for the Pokémon on the target card;
// look-alike decoys near the target make it a real search. Positive-only:
// tapping anyone else just wiggles them.
//
// Hint flow: pages without a math hook speak the hint and shimmer near the
// target. Pages WITH a hook (tiers 3-5) gate the FIRST hint behind one
// template-generated math problem — solving it "powers up the magnifying
// glass" (glide + zoom + shimmer). A wrong answer gently re-rolls; no
// lockout, no negative cue. All spoken strings are enumerated by
// allSearchSpokenLines() and warmed by scripts/warm-tts.ts.
//
// Ages: 3yo plays tiers 1-2; 5yo plays all pages, gentlest first.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star, Sparkles, Search } from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playCorrect, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, speakSequence, stopSpeaking, prefetch } from "@/lib/tts";
import { useSession } from "@/context/SessionContext";
import {
  pagesForAge,
  searchPokemonName,
  findTargetLine,
  foundTargetLine,
  allSearchSpokenLines,
  makeHookProblem,
  SEARCH_DONE_LINE,
  SEARCH_SESSION_DONE_LINE,
  SEARCH_MATH_LINE,
  SEARCH_MATH_SOLVED_LINE,
  type HookProblem,
} from "@/content/search";
import { SearchScene } from "@/components/SearchScene";

const SPRITE = ARTWORK;

// Matches seek/geography/science: definite page height under the TopBar.
const PAGE_HEIGHT = "calc(100vh - 200px)";

// Psyduck — the perpetually puzzled searcher (also the home-tile mascot).
const CELEBRATION_ID = 54;

export default function SearchPage() {
  const { profile, logAttempt } = useSession();
  const [, navigate] = useLocation();

  const is3yo = (profile?.age ?? 5) <= 3;
  const pages = useMemo(() => pagesForAge(is3yo), [is3yo]);

  const [pageIdx, setPageIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [found, setFound] = useState(false);
  const [hintNonce, setHintNonce] = useState(0);
  const [magnifyNonce, setMagnifyNonce] = useState(0);
  const [hookSolved, setHookSolved] = useState(false);
  const [hookProblem, setHookProblem] = useState<HookProblem | null>(null);

  const page = pages[pageIdx];
  const targetId = page.target.species;

  // Prefetch every phrase this page can speak (byte-matched by warm-tts).
  useEffect(() => {
    void prefetch(allSearchSpokenLines().map((text) => ({ text, lang: "en" as const })));
    return () => stopSpeaking();
  }, []);

  // New page: reset and announce who to find.
  useEffect(() => {
    setFound(false);
    setHintNonce(0);
    setMagnifyNonce(0);
    setHookSolved(false);
    setHookProblem(null);
    void speakText(findTargetLine(page.target.species), "en");
  }, [page]);

  const handleTapSprite = useCallback(
    (isTarget: boolean) => {
      if (found) return;
      if (!isTarget) {
        playTap(); // friendly wiggle happens in SearchScene — never a "wrong"
        return;
      }
      playCorrect();
      setFound(true);
      void speakSequence([
        { text: foundTargetLine(targetId), lang: "en" },
        { text: SEARCH_DONE_LINE, lang: "en" },
      ]);
      void logAttempt("search", page.id, true);
    },
    [found, targetId, page.id, logAttempt],
  );

  const handleHint = useCallback(() => {
    playTap();
    if (found) return;
    if (page.mathHook && !hookSolved) {
      setHookProblem(makeHookProblem(page.mathHook));
      void speakText(SEARCH_MATH_LINE, "en");
      return;
    }
    void speakText(page.hintText, "en");
    setHintNonce((n) => n + 1);
  }, [page, found, hookSolved]);

  const handleHookAnswer = useCallback(
    (choice: number) => {
      if (!hookProblem) return;
      if (choice !== hookProblem.answer) {
        playTap();
        setHookProblem(makeHookProblem(page.mathHook!)); // gentle re-roll
        return;
      }
      playCorrect();
      setHookSolved(true);
      setHookProblem(null);
      void speakSequence([
        { text: SEARCH_MATH_SOLVED_LINE, lang: "en" },
        { text: page.hintText, lang: "en" },
      ]);
      setMagnifyNonce((n) => n + 1);
    },
    [hookProblem, page],
  );

  const handleNextPage = useCallback(() => {
    if (pageIdx + 1 >= pages.length) {
      stopSpeaking();
      playFanfare();
      playJingle();
      void speakText(SEARCH_SESSION_DONE_LINE, "en");
      setDone(true);
    } else {
      setPageIdx((i) => i + 1);
    }
  }, [pageIdx, pages.length]);

  const startNewGame = useCallback(() => {
    stopSpeaking();
    stopMusic();
    setPageIdx(0);
    setDone(false);
    setFound(false);
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
            alt="Psyduck"
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <h2 className="text-6xl font-black text-pokemon-blue leading-tight">Incredible searching!</h2>
          <p className="text-3xl font-bold text-gray-600">
            You found every hidden friend, {profile?.name ?? "friend"}!
          </p>

          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {pages.map((p) => (
              <motion.div
                key={p.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Star size={40} className="text-pokemon-yellow fill-pokemon-yellow" />
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
      <SearchScene
        page={page}
        found={found}
        hintNonce={hintNonce}
        magnifyNonce={magnifyNonce}
        onTapSprite={handleTapSprite}
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

      {/* Target card — WHO to find. pointer-events-none so stray taps fall
          through to the picture. */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
        <div className="flex items-center gap-4 rounded-3xl bg-white/90 px-6 py-3 shadow-lg backdrop-blur">
          <Search size={34} className="text-pokemon-blue" aria-hidden="true" />
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-wide text-slate-600">Can you find…</p>
            <p className="text-2xl font-black text-slate-900">{searchPokemonName(targetId)}</p>
          </div>
          <div
            className={`relative h-20 w-20 rounded-2xl border-4 p-1 transition-colors ${
              found ? "border-pokemon-yellow bg-yellow-50" : "border-slate-200 bg-white"
            }`}
          >
            <img
              src={SPRITE(targetId)}
              onError={onSpriteError}
              alt={searchPokemonName(targetId)}
              className="h-full w-full object-contain"
            />
            {found && (
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
        </div>
      </div>

      <div className="absolute right-4 top-4 z-20 rounded-2xl bg-white/95 px-5 py-3 shadow-lg" role="status">
        <p className="text-xl font-black text-gray-700">
          Picture {pageIdx + 1} / {pages.length}
        </p>
      </div>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleHint}
        aria-label="Hint: help me find the hidden Pokémon"
        className="absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-2xl border-4 border-pokemon-yellow bg-white/95 px-6 shadow-lg min-h-[88px] active:bg-yellow-50"
      >
        <Sparkles className="text-pokemon-yellow" size={30} />
        <span className="text-xl font-black text-gray-700">
          {page.mathHook && !hookSolved ? "Magnifier" : "Hint"}
        </span>
      </motion.button>

      {/* Math-hook overlay: one template problem unlocks the magnifier. */}
      <AnimatePresence>
        {hookProblem && (
          <motion.div
            key="math-hook"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative flex flex-col items-center gap-6 rounded-[2.5rem] bg-white px-12 py-10 shadow-2xl mx-6"
            >
              <button
                onClick={() => {
                  playTap();
                  setHookProblem(null);
                }}
                aria-label="Close"
                className="absolute -right-4 -top-4 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-gray-100 text-3xl font-black text-gray-500 shadow-lg"
              >
                ✕
              </button>
              <div className="flex items-center gap-3">
                <Search size={36} className="text-pokemon-blue" aria-hidden="true" />
                <p className="text-2xl font-black text-slate-700">Power up the magnifying glass!</p>
              </div>
              {hookProblem.countSprites ? (
                <div className="flex max-w-xl flex-wrap items-center justify-center gap-3">
                  {Array.from({ length: hookProblem.countSprites }).map((_, i) => (
                    <img
                      key={i}
                      src={SPRITE(targetId)}
                      onError={onSpriteError}
                      alt=""
                      className="h-20 w-20 object-contain"
                    />
                  ))}
                </div>
              ) : null}
              <p className="text-6xl font-black text-slate-900">{hookProblem.prompt}</p>
              <div className="flex gap-6">
                {hookProblem.choices.map((c) => (
                  <motion.button
                    key={c}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleHookAnswer(c)}
                    className="min-h-[100px] min-w-[120px] rounded-3xl bg-pokemon-blue px-8 text-5xl font-black text-white shadow-xl active:bg-blue-600"
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Found celebration */}
      <AnimatePresence>
        {found && (
          <motion.div
            key="page-done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.9 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-black/25 backdrop-blur-sm"
          >
            <motion.img
              src={SPRITE(targetId)}
              onError={onSpriteError}
              alt={searchPokemonName(targetId)}
              className="h-44 w-44 drop-shadow-2xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1, y: [0, -12, 0] }}
              transition={{ scale: { type: "spring", stiffness: 240, damping: 14 }, y: { duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: 0.4 } }}
            />
            <p className="text-4xl font-black text-white drop-shadow-lg text-center px-4">
              You found {searchPokemonName(targetId)}!
            </p>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 300 }}
                >
                  <Star size={44} className="text-pokemon-yellow fill-pokemon-yellow drop-shadow" />
                </motion.div>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={handleNextPage}
              className="bg-pokemon-blue text-white text-2xl font-black px-12 py-5 rounded-3xl shadow-xl min-h-[88px] min-w-[220px]"
            >
              {pageIdx + 1 < pages.length ? "Next Picture →" : "Finish"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
