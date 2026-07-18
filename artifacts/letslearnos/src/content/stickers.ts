// ---------------------------------------------------------------------------
// Sticker Book content — /stickers
//
// Stickers unlock purely from EXISTING play history (src/pages/stickers.tsx
// reads api.getStats(profileId).moduleBreakdown — see the build bible §6).
// There is no separate "sticker game" — this file only maps unlock rules
// onto the modules that already call logAttempt() in the app today.
//
// Static reward definitions; no runtime generation.
// What survived: the overall shape (24 stickers, gentle 1→10 count
// progression, spread across modules), most of the chosen Pokémon ids, and
// several of the fun nicknames.
// What was fixed:
//   - The draft's "space" module was replaced everywhere it appeared —
//     src/pages/space.tsx never calls logAttempt() (it's an exploratory,
//     no-right-answer page, same as geography.tsx), so any
//     unlock gated on it would have been permanently unreachable. Verified
//     against every page in src/pages by grepping for logAttempt(...) — the
//     only modules that ever log are: math, spanish, coloring, tracing,
//     dots, match, usa, canada, central-america, south-america. Rebalanced
//     the unlock counts across that real set (plus "any" for totalCorrect
//     milestones) so every sticker is actually reachable.
//   - Deduped a repeated pokemonId (151/Mew was used twice).
//   - Swapped numeric sticker ids for stable string ids — numeric ids would
//     silently orphan a child's saved placements (localStorage) if the list
//     is ever reordered or extended later.
//   - Fact-checked every pokemonId/name pair against src/content/pokedex.ts
//     and re-picked several nicknames that didn't match the Pokémon shown
//     (e.g. "Garden Helper" on Electrode, "Rainbow Maker" on Gengar) for
//     ones that actually fit (Zap Counter, Shadow Friend, etc.).
// ---------------------------------------------------------------------------

/** Modules that actually call logAttempt() in the app today (verified by
 *  grep across src/pages — geography/space/pokedex/regions/world-maps are
 *  exploratory pages with no right/wrong answers, so they never appear in
 *  api.getStats().moduleBreakdown; the 3D science lab DOES log station
 *  completions as of ADR-017). "any" is special-cased to totalCorrect
 *  across every module. */
export type UnlockModule =
  | "math"
  | "spanish"
  | "coloring"
  | "tracing"
  | "dots"
  | "match"
  | "usa"
  | "canada"
  | "central-america"
  | "south-america"
  | "science"
  | "puzzle"
  | "shadow"
  | "piano"
  | "seek"
  | "stories"
  | "maze"
  | "search"
  | "any";

export interface StickerUnlock {
  module: UnlockModule;
  /** Number of *correct* logged attempts in that module needed to unlock. */
  count: number;
}

export interface Sticker {
  /** Stable string id — used as the localStorage placement key, so it must
   *  never be reused/changed once shipped. */
  id: string;
  /** Fun kid-friendly nickname (not the official Pokédex name). */
  label: string;
  /** Bundled artwork id — src/lib/sprites ARTWORK(id). */
  pokemonId: number;
  unlock: StickerUnlock;
}

// Gentle progression: every module has a count:1 sticker (so the very first
// time a child finishes anything in that activity they get a surprise), then
// a couple of "keep going" milestones further out. Counts never require more
// than 10 correct attempts in one module (the "any" milestone tops out at 10
// total correct across every module).
export const STICKERS: Sticker[] = [
  { id: "sparkle-wing", label: "Sparkle Wing", pokemonId: 12, unlock: { module: "any", count: 1 } },
  { id: "spark-buddy", label: "Spark Buddy", pokemonId: 25, unlock: { module: "math", count: 1 } },
  { id: "sunny-song", label: "Sunny Song", pokemonId: 39, unlock: { module: "coloring", count: 1 } },
  { id: "splash-pal", label: "Splash Pal", pokemonId: 7, unlock: { module: "tracing", count: 1 } },
  { id: "leaf-sprout", label: "Leaf Sprout", pokemonId: 1, unlock: { module: "dots", count: 1 } },
  { id: "blaze-buddy", label: "Blaze Buddy", pokemonId: 6, unlock: { module: "match", count: 1 } },
  { id: "sky-scout", label: "Sky Scout", pokemonId: 16, unlock: { module: "usa", count: 1 } },
  { id: "maple-friend", label: "Maple Friend", pokemonId: 59, unlock: { module: "canada", count: 1 } },
  { id: "zigzag-friend", label: "Zigzag Friend", pokemonId: 24, unlock: { module: "spanish", count: 1 } },
  { id: "coin-collector", label: "Coin Collector", pokemonId: 52, unlock: { module: "math", count: 3 } },
  { id: "rock-pal", label: "Rock Pal", pokemonId: 74, unlock: { module: "tracing", count: 3 } },
  { id: "flower-friend", label: "Flower Friend", pokemonId: 69, unlock: { module: "coloring", count: 3 } },
  { id: "forest-fox", label: "Forest Fox", pokemonId: 133, unlock: { module: "dots", count: 3 } },
  { id: "copycat-friend", label: "Copycat Friend", pokemonId: 132, unlock: { module: "spanish", count: 3 } },
  { id: "rio-explorer", label: "Rio Explorer", pokemonId: 129, unlock: { module: "south-america", count: 1 } },
  { id: "rainforest-friend", label: "Rainforest Friend", pokemonId: 147, unlock: { module: "central-america", count: 1 } },
  { id: "forest-explorer", label: "Forest Explorer", pokemonId: 143, unlock: { module: "dots", count: 5 } },
  { id: "shadow-friend", label: "Shadow Friend", pokemonId: 94, unlock: { module: "coloring", count: 5 } },
  { id: "sky-guardian", label: "Sky Guardian", pokemonId: 149, unlock: { module: "match", count: 4 } },
  { id: "zap-counter", label: "Zap Counter", pokemonId: 101, unlock: { module: "math", count: 6 } },
  { id: "trail-guide", label: "Trail Guide", pokemonId: 151, unlock: { module: "usa", count: 5 } },
  { id: "puzzle-master", label: "Puzzle Master", pokemonId: 150, unlock: { module: "match", count: 6 } },
  { id: "champion-explorer", label: "Champion Explorer", pokemonId: 248, unlock: { module: "any", count: 6 } },
  { id: "legend-friend", label: "Legend Friend", pokemonId: 249, unlock: { module: "any", count: 10 } },
  // ADR-017 + arcade follow-up: every new activity gets a first-completion
  // surprise sticker, matching the count:1 convention above.
  { id: "little-scientist", label: "Little Scientist", pokemonId: 4, unlock: { module: "science", count: 1 } },
  { id: "puzzle-pal", label: "Puzzle Pal", pokemonId: 35, unlock: { module: "puzzle", count: 1 } },
  { id: "peek-a-boo", label: "Peek-a-Boo", pokemonId: 92, unlock: { module: "shadow", count: 1 } },
  { id: "tiny-tune", label: "Tiny Tune", pokemonId: 175, unlock: { module: "piano", count: 1 } },
  { id: "seek-star", label: "Seek Star", pokemonId: 50, unlock: { module: "seek", count: 1 } },
  { id: "bedtime-buddy", label: "Bedtime Buddy", pokemonId: 113, unlock: { module: "stories", count: 1 } },
  { id: "tunnel-runner", label: "Tunnel Runner", pokemonId: 27, unlock: { module: "maze", count: 1 } },
  // ADR-021 Hidden Search: first find earns the surprise sticker (count:1
  // convention); Psyduck matches the module's home-tile mascot.
  { id: "super-seeker", label: "Super Seeker", pokemonId: 54, unlock: { module: "search", count: 1 } },
];

// ---------------------------------------------------------------------------
// Decorate-able scenes — simple gradient backgrounds, no image assets.
// ---------------------------------------------------------------------------

export type SceneKey = "meadow" | "beach" | "night";

export interface SceneDef {
  key: SceneKey;
  label: string;
  gradient: string;
}

export const SCENES: SceneDef[] = [
  {
    key: "meadow",
    label: "Meadow",
    gradient:
      "linear-gradient(180deg, #8ed4ff 0%, #cdeeff 46%, #8fd66e 47%, #62b74a 100%)",
  },
  {
    key: "beach",
    label: "Beach",
    gradient:
      "linear-gradient(180deg, #7fd0ea 0%, #bdeaf5 46%, #f5e2a6 47%, #e9cf83 100%)",
  },
  {
    key: "night",
    label: "Night Sky",
    gradient: "linear-gradient(180deg, #16123a 0%, #2c1e63 55%, #3c2a7d 100%)",
  },
];

// ---------------------------------------------------------------------------
// Unlock evaluation — pure functions, no React, so the page can stay a thin
// consumer. Mirrors the shape of api.getStats()'s response (see
// src/lib/api.ts) without importing it, to keep this a plain content module.
// ---------------------------------------------------------------------------

export interface StatsLike {
  totalCorrect: number;
  totalAttempts: number;
  moduleBreakdown: Record<string, { correct: number; total: number }>;
}

/** How many correct attempts the child has toward this sticker's unlock. */
export function progressForUnlock(
  unlock: StickerUnlock,
  stats: StatsLike | null,
): number {
  if (!stats) return 0;
  if (unlock.module === "any") return stats.totalCorrect;
  return stats.moduleBreakdown[unlock.module]?.correct ?? 0;
}

export function isStickerUnlocked(
  sticker: Sticker,
  stats: StatsLike | null,
): boolean {
  return progressForUnlock(sticker.unlock, stats) >= sticker.unlock.count;
}

export function getUnlockedStickers(stats: StatsLike | null): Sticker[] {
  return STICKERS.filter((s) => isStickerUnlocked(s, stats));
}
