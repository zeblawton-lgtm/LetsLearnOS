// ---------------------------------------------------------------------------
// stories.tsx — Story Time module (route /stories)
//
// Picker -> Reader flow: pick a picture book, then read one page at a time.
// Each page composes its pokemonIds as big sprites over a scene gradient,
// with sentence-by-sentence narration + highlight driven by real playback
// completion (speakText resolves per sentence — no fake per-word timing).
// Positive feedback only; the last page ends in a "The End!" celebration.
// ---------------------------------------------------------------------------

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Volume2,
  BookOpen,
  PartyPopper,
  Star,
} from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap, playFanfare } from "@/lib/sound";
import { playJingle, stop as stopMusic } from "@/lib/music";
import { speakText, stopSpeaking, prefetch } from "@/lib/tts";
import { spokenText } from "@/lib/pronounce";
import { useSession } from "@/context/SessionContext";
import { stories, type Story, type StoryScene } from "@/content/stories";
import { StoryScene as StoryDiorama } from "@/components/StoryScene";

const SPRITE = ARTWORK;

// The kiosk never scrolls, so pages need a definite height — App wraps every
// route below the 80px safe strip + 88px TopBar (no definite height), so a page
// root's h-full resolves to auto. That collapses any flex-1 child whose only
// content is absolutely positioned (like the reader's illustration stage,
// which has zero intrinsic height) and makes 'justify-center' a no-op on the
// celebration screen. Same trap documented in geography.tsx and match.tsx.
const PAGE_HEIGHT = "calc(100vh - 200px)";

// Scene gradients — soft, storybook-like skies. "night" gets a starry navy
// gradient instead of daylight blues.
const SCENE_GRADIENTS: Record<StoryScene, string> = {
  meadow: "linear-gradient(180deg,#8ed4ff 0%,#c8ecff 45%,#b6e88a 100%)",
  forest: "linear-gradient(180deg,#bfe9ff 0%,#d7f5c8 45%,#5aa856 100%)",
  beach: "linear-gradient(180deg,#7fd7ff 0%,#bdeeff 55%,#ffe9a8 100%)",
  pond: "linear-gradient(180deg,#a6e3ff 0%,#d7f3e6 55%,#8fd6c2 100%)",
  mountain: "linear-gradient(180deg,#a9d6ff 0%,#e3eef7 55%,#b7b0a6 100%)",
  snow: "linear-gradient(180deg,#cdeeff 0%,#eef8ff 55%,#ffffff 100%)",
  night: "linear-gradient(180deg,#1b2a63 0%,#33438c 55%,#5c6bab 100%)",
};

// Splits page text into sentence-sized chunks for narration highlighting.
// Keeps a trailing closing quote glued to its sentence ("Let's go!" stays
// whole) instead of splitting off as a stray punctuation-only fragment.
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]*[.!?]+["”]?/g);
  if (!parts) return [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

function storyById(id: number): Story | undefined {
  return stories.find((s) => s.id === id);
}

export default function StoriesPage() {
  const { logAttempt } = useSession();
  const [, navigate] = useLocation();

  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [replayNonce, setReplayNonce] = useState(0);
  const [sceneError, setSceneError] = useState<string | null>(null);

  // Bumped on every page/replay change so an in-flight narration loop from a
  // stale page can tell it's been superseded and stop touching state.
  const narrationGenRef = useRef(0);

  const activeStory = useMemo(
    () => (activeStoryId != null ? storyById(activeStoryId) : undefined),
    [activeStoryId],
  );

  // Warm the TTS cache for a story's full text the moment it's opened.
  useEffect(() => {
    if (!activeStory) return;
    const utterances = activeStory.pages
      .flatMap((p) => splitSentences(p.text))
      .map((t) => ({ text: spokenText(t), lang: "en" as const }));
    void prefetch(utterances);
  }, [activeStory]);

  // Narrate the current page sentence-by-sentence, highlighting each one in
  // sync with real playback completion — speakText's promise resolves when
  // that clip finishes, so the highlight tracks actual narration, not a
  // guessed/fake per-word timer.
  useEffect(() => {
    if (!activeStory || finished) {
      setHighlightIdx(-1);
      return;
    }
    const page = activeStory.pages[pageIndex];
    const sentences = splitSentences(page.text);
    narrationGenRef.current += 1;
    const myGen = narrationGenRef.current;

    void (async () => {
      for (let i = 0; i < sentences.length; i++) {
        if (narrationGenRef.current !== myGen) return;
        setHighlightIdx(i);
        await speakText(spokenText(sentences[i]), "en");
      }
      if (narrationGenRef.current === myGen) setHighlightIdx(-1);
    })();

    return () => {
      narrationGenRef.current += 1;
      stopSpeaking();
    };
  }, [activeStory, pageIndex, finished, replayNonce]);

  // Stop any narration outright if the whole page unmounts.
  useEffect(() => () => stopSpeaking(), []);

  // The 3D diorama's fallback card must be narrated too — a pre-reader
  // can't read why the picture scene went away or that the story text and
  // buttons still work (same discipline as geography.tsx's globeError).
  useEffect(() => {
    if (sceneError) {
      void speakText(
        "The picture scene is resting right now. The story words below still work.",
        "en",
      );
    }
  }, [sceneError]);

  const openStory = useCallback((story: Story) => {
    playTap();
    setActiveStoryId(story.id);
    setPageIndex(0);
    setFinished(false);
    // A fresh StoryScene mount gets a fresh WebGL context — worth clearing
    // any prior failure so a new story gets its own chance.
    setSceneError(null);
  }, []);

  const closeToPicker = useCallback(() => {
    playTap();
    stopSpeaking();
    setActiveStoryId(null);
    setFinished(false);
  }, []);

  const handleFinish = useCallback(() => {
    if (!activeStory) return;
    playTap();
    stopSpeaking();
    // A same-route "Read Again" would otherwise stack this jingle under an
    // already-playing one — clear any prior music/jingle first (match.tsx
    // documents this same gotcha for same-route resets).
    stopMusic();
    playFanfare();
    playJingle();
    void logAttempt("stories", `story-${activeStory.id}`, true);
    setFinished(true);
  }, [activeStory, logAttempt]);

  const handleNext = useCallback(() => {
    if (!activeStory) return;
    if (pageIndex >= activeStory.pages.length - 1) {
      handleFinish();
      return;
    }
    playTap();
    setPageIndex((p) => p + 1);
  }, [activeStory, pageIndex, handleFinish]);

  const handlePrev = useCallback(() => {
    if (pageIndex <= 0) return;
    playTap();
    setPageIndex((p) => p - 1);
  }, [pageIndex]);

  const handleReplay = useCallback(() => {
    playTap();
    setReplayNonce((n) => n + 1);
  }, []);

  const readAgain = useCallback(() => {
    playTap();
    stopMusic();
    setPageIndex(0);
    setFinished(false);
  }, []);

  const moreStories = useCallback(() => {
    playTap();
    stopMusic();
    setActiveStoryId(null);
    setFinished(false);
  }, []);

  // -------------------------------------------------------------------------
  // Celebration screen ("The End!")
  // -------------------------------------------------------------------------
  if (finished && activeStory) {
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
          <motion.img
            src={SPRITE(activeStory.coverPokemonId)}
            onError={onSpriteError}
            alt=""
            className="w-48 h-48 drop-shadow-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <h2 className="text-6xl font-black text-pokemon-blue leading-tight flex items-center gap-3">
            <PartyPopper size={52} className="text-pokemon-yellow" />
            The End!
          </h2>
          <p className="text-3xl font-bold text-gray-600">
            You read {activeStory.title}!
          </p>

          <div className="flex gap-2 justify-center flex-wrap max-w-lg">
            {activeStory.pages.map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 300 }}
              >
                <Star size={44} className="text-pokemon-yellow fill-pokemon-yellow" />
              </motion.div>
            ))}
          </div>

          <div className="flex gap-6 mt-4 flex-wrap justify-center">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={readAgain}
              className="bg-pokemon-blue text-white text-3xl font-black px-12 py-6 rounded-3xl shadow-xl min-h-[88px] min-w-[220px]"
            >
              Read Again
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={moreStories}
              className="bg-gray-200 text-gray-700 text-3xl font-black px-12 py-6 rounded-3xl shadow-xl min-h-[88px] min-w-[220px]"
            >
              More Stories
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Picker screen
  // -------------------------------------------------------------------------
  if (!activeStory) {
    return (
      <div className="flex flex-col h-full px-4 py-4">
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={() => {
              playTap();
              navigate("/home");
            }}
            className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200"
            aria-label="Back to Home"
          >
            <ArrowLeft size={44} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-pokemon-blue leading-tight flex items-center gap-3">
              <BookOpen size={32} />
              Story Time
            </h1>
            <p className="text-xl font-bold text-gray-500 mt-0.5">
              Pick a story to read together!
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-4 gap-6 overflow-y-auto pb-4 content-start">
          {stories.map((story, i) => (
            <motion.button
              key={story.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 220 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => openStory(story)}
              className="rounded-[32px] flex flex-col items-center justify-end gap-2 p-4 text-white min-h-[240px] shadow-xl relative overflow-hidden"
              style={{ background: SCENE_GRADIENTS[story.pages[0].scene] }}
            >
              <img
                src={SPRITE(story.coverPokemonId)}
                onError={onSpriteError}
                alt=""
                className="w-32 h-32 object-contain drop-shadow-xl"
                draggable={false}
              />
              <span
                className="text-xl font-black text-center leading-tight"
                style={{ textShadow: "0 2px 0 rgba(0,0,0,0.25)" }}
              >
                {story.title}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Reader screen
  // -------------------------------------------------------------------------
  const page = activeStory.pages[pageIndex];
  const sentences = splitSentences(page.text);
  const isLastPage = pageIndex >= activeStory.pages.length - 1;

  return (
    <div
      className="flex flex-col px-4 py-4 gap-3"
      style={{ height: PAGE_HEIGHT }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={closeToPicker}
          className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200"
          aria-label="Back to story picker"
        >
          <ArrowLeft size={44} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black text-pokemon-blue leading-tight truncate">
            {activeStory.title}
          </h1>
          <p className="text-xl font-bold text-gray-500 mt-0.5">
            Page {pageIndex + 1} of {activeStory.pages.length}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-1.5">
            <motion.div
              className="bg-pokemon-blue h-3 rounded-full"
              animate={{ width: `${((pageIndex + 1) / activeStory.pages.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <button
          onClick={handleReplay}
          className="w-[88px] h-[88px] rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 active:bg-blue-100"
          aria-label="Read this page again"
        >
          <Volume2 size={36} className="text-pokemon-blue" />
        </button>
      </div>

      {/* Illustration + huge nav arrows + text */}
      <div className="relative flex-1 flex flex-col min-h-0 gap-3">
        {pageIndex > 0 && (
          <button
            onClick={handlePrev}
            aria-label="Previous page"
            className="absolute z-30 left-1 md:left-3 top-[38%] -translate-y-1/2 w-[120px] h-[120px] rounded-full bg-white/90 shadow-2xl flex items-center justify-center active:scale-95 transition-transform border-4 border-white"
          >
            <ChevronLeft size={64} className="text-pokemon-blue" />
          </button>
        )}
        <button
          onClick={handleNext}
          aria-label={isLastPage ? "Finish story" : "Next page"}
          className={`absolute z-30 right-1 md:right-3 top-[38%] -translate-y-1/2 w-[120px] h-[120px] rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform border-4 border-white ${
            isLastPage ? "bg-pokemon-yellow" : "bg-white/90"
          }`}
        >
          {isLastPage ? (
            <PartyPopper size={58} className="text-amber-900" />
          ) : (
            <ChevronRight size={64} className="text-pokemon-blue" />
          )}
        </button>

        {/* Illustration — a persistent 3D diorama (ADR-018). One renderer
            lives for the whole reader session; StoryDiorama rebuilds its
            ground/props/particles/billboards on every page turn (keyed on
            pageKey) with a quick camera-sweep transition, so the CSS
            gradient + <img> sprites this used to be are gone from the DOM
            entirely — the canvas is the only thing drawn here. */}
        <div className="flex-1 min-h-0 rounded-[40px] relative overflow-hidden shadow-xl border-4 border-white">
          <StoryDiorama
            scene={page.scene}
            pokemonIds={page.pokemonIds}
            pageKey={`${activeStory.id}-${pageIndex}`}
            onError={setSceneError}
            className="absolute inset-0 z-0"
          />
        </div>

        {/* Text panel */}
        <div className="shrink-0 bg-white rounded-3xl shadow-lg px-8 py-6">
          <p className="text-4xl font-black leading-snug text-center text-gray-800">
            {sentences.map((s, i) => (
              <motion.span
                key={i}
                animate={{
                  color: i === highlightIdx ? "#3b4cca" : "#1f2937",
                  scale: i === highlightIdx ? 1.04 : 1,
                }}
                transition={{ duration: 0.25 }}
                className={`inline-block mx-1 rounded-xl px-1 ${
                  i === highlightIdx ? "bg-yellow-100" : ""
                }`}
              >
                {s}
              </motion.span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
