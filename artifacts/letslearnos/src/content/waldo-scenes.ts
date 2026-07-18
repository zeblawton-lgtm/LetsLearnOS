// ---------------------------------------------------------------------------
// Hide & Seek "Where's Waldo" scenes (route /seek, ADR-020).
//
// Each scene is a wide (3.2:1) richly illustrated landscape — the artwork
// itself lives in src/components/WaldoBackdrop.tsx, keyed by `theme` — with
// a dense crowd of ~20 bundled Pokémon placed on it. A handful are marked
// `target: true`; those are the ones the child is asked to find (shown in
// the target strip at the top of the page). Everyone else is a friendly
// decoy: tapping a decoy just makes it wiggle — there is no "wrong" tap.
//
// Coordinates are percentages of the scene box (which is ~1.4x wider than
// the viewport and panned by dragging): xPct/yPct are the sprite's center,
// sizePct is the sprite width as a % of scene WIDTH. Keep yPct >= 18 so no
// sprite can hide under the fixed top-strip UI at any pan position, and
// keep target sizePct >= 3.3 so the rendered sprite stays comfortably
// tappable (the hit area is additionally floored at 88px in WaldoScene).
//
// Placements are matched to the backdrop art: water Pokémon sit in each
// scene's water band, flyers in the sky band, walkers on the ground band.
// ---------------------------------------------------------------------------
// Relative imports (not "@/") so scripts/warm-tts.ts can load this module
// under tsx without path-alias resolution (same reason as lib/pronounce.ts).

import { pokedex } from "./pokedex";
import { spokenName } from "../lib/pronounce";

export type WaldoTheme = "beach" | "garden" | "snow" | "market" | "carnival";

export interface WaldoPokemon {
  id: number; // bundled Pokédex id (rendered via ARTWORK(id))
  xPct: number; // center, 2-98, % of scene width
  yPct: number; // center, 18-94, % of scene height
  sizePct: number; // sprite width, % of scene width (2.8-6)
  flip?: boolean; // mirror the sprite so crowds don't all face one way
  target?: boolean; // true = one of the Pokémon the child is asked to find
}

export interface WaldoScene {
  id: number;
  name: string;
  theme: WaldoTheme;
  intro: string; // narrated once when the scene appears
  pokemon: WaldoPokemon[];
}

const NAME_BY_ID = new Map(pokedex.map((p) => [p.id, p.name]));

/** Display name for a placed Pokémon (real spelling, for the target strip). */
export function pokemonName(id: number): string {
  return NAME_BY_ID.get(id) ?? "Pokémon";
}

/** Exact string spoken when a target is found (phonetic respelling for TTS). */
export function foundSpokenLine(id: number): string {
  return `You found ${spokenName(pokemonName(id))}!`;
}

export const waldoScenes: WaldoScene[] = [
  // -------------------------------------------------------------------------
  // Scene 1 — beach. Gentlest scene (3yo plays this first): fewer decoys,
  // bigger sprites, big color contrast between targets and sand/sea.
  // Sky y<32, sea band y 32-52, sand y 52-94.
  // -------------------------------------------------------------------------
  {
    id: 1,
    name: "Sunny Beach Party",
    theme: "beach",
    intro: "What a sunny beach party!",
    pokemon: [
      { id: 16, xPct: 10, yPct: 23, sizePct: 3.0 },
      { id: 12, xPct: 90, yPct: 21, sizePct: 3.4, flip: true },
      { id: 87, xPct: 30, yPct: 40, sizePct: 4.4 },
      { id: 131, xPct: 44, yPct: 38, sizePct: 5.0, target: true },
      { id: 116, xPct: 52, yPct: 43, sizePct: 3.0, flip: true },
      { id: 129, xPct: 58, yPct: 45, sizePct: 3.4 },
      { id: 320, xPct: 78, yPct: 36, sizePct: 5.5 },
      { id: 55, xPct: 22, yPct: 46, sizePct: 4.0, flip: true },
      { id: 54, xPct: 8, yPct: 62, sizePct: 4.2 },
      { id: 7, xPct: 18, yPct: 80, sizePct: 4.0, target: true },
      { id: 8, xPct: 12, yPct: 90, sizePct: 3.6, flip: true },
      { id: 120, xPct: 28, yPct: 88, sizePct: 3.4 },
      { id: 90, xPct: 36, yPct: 91, sizePct: 3.0 },
      { id: 35, xPct: 34, yPct: 68, sizePct: 3.6, flip: true },
      { id: 60, xPct: 46, yPct: 78, sizePct: 3.2 },
      { id: 25, xPct: 62, yPct: 74, sizePct: 4.2, target: true },
      { id: 366, xPct: 64, yPct: 91, sizePct: 2.8 },
      { id: 222, xPct: 70, yPct: 88, sizePct: 3.4, flip: true },
      { id: 9, xPct: 75, yPct: 62, sizePct: 5.0 },
      { id: 39, xPct: 84, yPct: 74, sizePct: 3.4 },
      { id: 98, xPct: 88, yPct: 87, sizePct: 3.8, target: true },
      { id: 79, xPct: 94, yPct: 66, sizePct: 4.4, flip: true },
    ],
  },
  // -------------------------------------------------------------------------
  // Scene 2 — garden. Grass-types hide among the giant flowers; the
  // camouflage IS the challenge (Bellossom among blooms, Sunkern in petals).
  // Sky y<30, meadow y 30-94, pond around x 36-50 / y 58-70.
  // -------------------------------------------------------------------------
  {
    id: 2,
    name: "Flower Garden Festival",
    theme: "garden",
    intro: "The flower garden is blooming!",
    pokemon: [
      { id: 12, xPct: 14, yPct: 22, sizePct: 3.4 },
      { id: 187, xPct: 30, yPct: 26, sizePct: 3.0, flip: true },
      { id: 16, xPct: 46, yPct: 20, sizePct: 3.0 },
      { id: 189, xPct: 74, yPct: 22, sizePct: 3.6 },
      { id: 152, xPct: 6, yPct: 70, sizePct: 3.8 },
      { id: 69, xPct: 16, yPct: 66, sizePct: 3.6, flip: true },
      { id: 1, xPct: 26, yPct: 82, sizePct: 4.2, target: true },
      { id: 39, xPct: 22, yPct: 91, sizePct: 3.4 },
      { id: 43, xPct: 8, yPct: 85, sizePct: 3.2, flip: true },
      { id: 10, xPct: 38, yPct: 76, sizePct: 3.2 },
      { id: 183, xPct: 42, yPct: 63, sizePct: 3.6 },
      { id: 175, xPct: 48, yPct: 88, sizePct: 3.6, target: true },
      { id: 173, xPct: 54, yPct: 66, sizePct: 3.0, flip: true },
      { id: 191, xPct: 58, yPct: 85, sizePct: 2.8 },
      { id: 35, xPct: 62, yPct: 78, sizePct: 3.6 },
      { id: 133, xPct: 70, yPct: 68, sizePct: 4.2, target: true },
      { id: 174, xPct: 80, yPct: 89, sizePct: 3.0 },
      { id: 2, xPct: 84, yPct: 60, sizePct: 4.4, flip: true },
      { id: 182, xPct: 88, yPct: 78, sizePct: 3.8, target: true },
      { id: 192, xPct: 94, yPct: 62, sizePct: 4.0 },
      { id: 113, xPct: 93, yPct: 90, sizePct: 4.0, flip: true },
    ],
  },
  // -------------------------------------------------------------------------
  // Scene 3 — snow. White/pink Pokémon fade into the snow on purpose
  // (Jigglypuff vs snowdrifts, Ditto vs the pink dusk light).
  // Sky y<34, village/snowfield y 34-94, frozen pond x 40-62 / y 60-76.
  // -------------------------------------------------------------------------
  {
    id: 3,
    name: "Snowy Mountain Village",
    theme: "snow",
    intro: "It's a snowy mountain village!",
    pokemon: [
      { id: 196, xPct: 6, yPct: 58, sizePct: 4.0 },
      { id: 173, xPct: 18, yPct: 60, sizePct: 2.8, flip: true },
      { id: 216, xPct: 14, yPct: 72, sizePct: 3.8, target: true },
      { id: 39, xPct: 8, yPct: 86, sizePct: 3.2 },
      { id: 40, xPct: 24, yPct: 88, sizePct: 3.6, flip: true },
      { id: 133, xPct: 30, yPct: 62, sizePct: 3.6 },
      { id: 37, xPct: 34, yPct: 80, sizePct: 4.0, target: true },
      { id: 26, xPct: 40, yPct: 90, sizePct: 3.8, flip: true },
      { id: 87, xPct: 44, yPct: 66, sizePct: 4.4 },
      { id: 147, xPct: 50, yPct: 74, sizePct: 3.2 },
      { id: 131, xPct: 56, yPct: 62, sizePct: 4.6, flip: true },
      { id: 132, xPct: 56, yPct: 88, sizePct: 3.4, target: true },
      { id: 148, xPct: 62, yPct: 70, sizePct: 4.2 },
      { id: 172, xPct: 66, yPct: 80, sizePct: 3.0, flip: true },
      { id: 113, xPct: 70, yPct: 89, sizePct: 3.8 },
      { id: 143, xPct: 78, yPct: 72, sizePct: 6.0, target: true },
      { id: 35, xPct: 84, yPct: 90, sizePct: 3.2 },
      { id: 25, xPct: 88, yPct: 84, sizePct: 3.8, flip: true },
      { id: 174, xPct: 92, yPct: 76, sizePct: 3.0 },
      { id: 197, xPct: 95, yPct: 62, sizePct: 4.0, flip: true },
    ],
  },
  // -------------------------------------------------------------------------
  // Scene 4 — market (5yo only). Busiest ground band: the crowd bustles
  // between stalls, so targets hide in plain sight among lookalikes
  // (Charmander next to Charmeleon, Meowth near Persian).
  // Sky y<30, houses y 30-55, street y 55-94, fountain around x 56-64.
  // -------------------------------------------------------------------------
  {
    id: 4,
    name: "Busy Market Town",
    theme: "market",
    intro: "Welcome to the busy market!",
    pokemon: [
      { id: 16, xPct: 30, yPct: 24, sizePct: 3.0 },
      { id: 12, xPct: 86, yPct: 26, sizePct: 3.2, flip: true },
      { id: 448, xPct: 6, yPct: 74, sizePct: 4.4 },
      { id: 53, xPct: 12, yPct: 64, sizePct: 4.2, flip: true },
      { id: 19, xPct: 8, yPct: 89, sizePct: 3.2 },
      { id: 172, xPct: 16, yPct: 90, sizePct: 2.8, flip: true },
      { id: 4, xPct: 20, yPct: 84, sizePct: 4.0, target: true },
      { id: 26, xPct: 28, yPct: 74, sizePct: 3.8 },
      { id: 43, xPct: 34, yPct: 88, sizePct: 3.0, flip: true },
      { id: 77, xPct: 38, yPct: 62, sizePct: 4.6, target: true },
      { id: 74, xPct: 44, yPct: 90, sizePct: 3.2 },
      { id: 58, xPct: 48, yPct: 84, sizePct: 3.8, flip: true },
      { id: 25, xPct: 52, yPct: 64, sizePct: 3.6 },
      { id: 129, xPct: 60, yPct: 56, sizePct: 3.2 },
      { id: 52, xPct: 58, yPct: 78, sizePct: 3.8, target: true },
      { id: 113, xPct: 64, yPct: 90, sizePct: 3.8, flip: true },
      { id: 39, xPct: 68, yPct: 76, sizePct: 3.2 },
      { id: 128, xPct: 72, yPct: 64, sizePct: 5.0, flip: true },
      { id: 133, xPct: 76, yPct: 88, sizePct: 3.4 },
      { id: 179, xPct: 84, yPct: 82, sizePct: 4.2, target: true },
      { id: 241, xPct: 92, yPct: 66, sizePct: 4.6, flip: true },
      { id: 5, xPct: 90, yPct: 89, sizePct: 4.0 },
    ],
  },
  // -------------------------------------------------------------------------
  // Scene 5 — carnival (5yo only, hardest: 5 targets). Night palette makes
  // dark targets (Gengar, Mimikyu) genuinely tricky; two targets are up in
  // the sky so the child has to search high as well as low.
  // Sky y<48, midway/ground y 48-94, ferris wheel around x 78-92.
  // -------------------------------------------------------------------------
  {
    id: 5,
    name: "Twilight Carnival",
    theme: "carnival",
    intro: "The night carnival is glowing!",
    pokemon: [
      { id: 151, xPct: 30, yPct: 26, sizePct: 3.6, target: true },
      { id: 6, xPct: 42, yPct: 28, sizePct: 5.0, flip: true },
      { id: 92, xPct: 64, yPct: 32, sizePct: 3.4 },
      { id: 145, xPct: 88, yPct: 21, sizePct: 5.0, target: true },
      { id: 150, xPct: 18, yPct: 60, sizePct: 4.4 },
      { id: 196, xPct: 6, yPct: 66, sizePct: 4.0, flip: true },
      { id: 778, xPct: 12, yPct: 82, sizePct: 3.6, target: true },
      { id: 37, xPct: 10, yPct: 92, sizePct: 3.4, flip: true },
      { id: 172, xPct: 22, yPct: 88, sizePct: 3.0 },
      { id: 148, xPct: 28, yPct: 68, sizePct: 4.0, flip: true },
      { id: 173, xPct: 36, yPct: 90, sizePct: 2.8 },
      { id: 25, xPct: 46, yPct: 86, sizePct: 3.6, flip: true },
      { id: 149, xPct: 52, yPct: 68, sizePct: 4.8, target: true },
      { id: 132, xPct: 50, yPct: 92, sizePct: 3.0 },
      { id: 39, xPct: 58, yPct: 90, sizePct: 3.2, flip: true },
      { id: 147, xPct: 66, yPct: 88, sizePct: 3.2 },
      { id: 94, xPct: 72, yPct: 78, sizePct: 4.2, target: true },
      { id: 133, xPct: 74, yPct: 91, sizePct: 3.4, flip: true },
      { id: 35, xPct: 80, yPct: 88, sizePct: 3.4 },
      { id: 882, xPct: 84, yPct: 60, sizePct: 4.4, flip: true },
      { id: 197, xPct: 92, yPct: 70, sizePct: 4.0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Every string this module can speak, for scripts/warm-tts.ts (same contract
// as content/rocket.ts's allRocketSpokenLines): the page speaks EXACTLY
// these strings, so warming them guarantees zero runtime synthesis waits.
// ---------------------------------------------------------------------------
export const SEEK_DONE_LINE = "You found them all!";
export const SEEK_SESSION_DONE_LINE = "Amazing seeking! You found every single one!";

export function findPromptLine(count: number): string {
  return `Can you find ${count} hidden friends?`;
}

export function allSeekSpokenLines(): string[] {
  const lines: string[] = [SEEK_DONE_LINE, SEEK_SESSION_DONE_LINE];
  const counts = new Set<number>();
  for (const scene of waldoScenes) {
    lines.push(scene.intro);
    const targets = scene.pokemon.filter((p) => p.target);
    counts.add(targets.length);
    counts.add(Math.min(3, targets.length)); // 3yo plays a trimmed target list
    for (const t of targets) lines.push(foundSpokenLine(t.id));
  }
  for (const n of counts) lines.push(findPromptLine(n));
  return lines;
}
