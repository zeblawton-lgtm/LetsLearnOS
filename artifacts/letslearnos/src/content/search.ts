// ---------------------------------------------------------------------------
// Hidden Search content module (route /search, ADR-021).
//
// Types mirror schemas/waldo_page.schema.json (camelCased); the actual page
// data lives in search-pages.gen.ts, emitted from content/waldo_pages/*.json
// by scripts/waldo-pack.py — never edit the gen file by hand. Pages were
// authored as JSON from reviewed scene briefs and accepted by
// scripts/validate_waldo.py (single target, density/occlusion budgets,
// decoy look-alike table, band sanity — see docs/hidden-search-design.md).
//
// Coordinates are logical px on a fixed 3200x1000 canvas (3.2:1, same
// aspect as /seek). The math hook carries TEMPLATE PARAMETERS only — the
// page instantiates an actual problem at runtime; no LLM-written math.
// ---------------------------------------------------------------------------
// Relative imports (not "@/") so scripts/warm-tts.ts can load this module
// under tsx without path-alias resolution (same reason as waldo-scenes.ts).

import { pokedex } from "./pokedex";
import { spokenName } from "../lib/pronounce";
import { searchPages } from "./search-pages.gen";

export { searchPages };

export const SEARCH_CANVAS = { w: 3200, h: 1000 } as const;

export type SearchTheme =
  | "city-street"
  | "festival"
  | "market"
  | "beach"
  | "forest"
  | "gym"
  | "harbor"
  | "train-station"
  | "snowfield"
  | "meadow";

export interface SearchEntity {
  /** "pokemon:<id>" | "npc:<name>" | "prop:<name>" */
  assetId: string;
  type: "pokemon" | "npc" | "prop";
  x: number;
  y: number;
  zLayer: number;
  scale: number; // rendered width in canvas px
  flip?: boolean;
}

export interface SearchDecoy {
  species: number;
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
}

export interface SearchTarget {
  species: number;
  x: number;
  y: number;
  scale: number;
  occlusionPct: number;
}

export interface SearchMathHook {
  skill: "count" | "add" | "subtract" | "multiply";
  max: number;
}

export interface SearchPage {
  id: string;
  theme: SearchTheme;
  difficulty: 1 | 2 | 3 | 4 | 5;
  target: SearchTarget;
  decoys: SearchDecoy[];
  entities: SearchEntity[];
  hintText: string;
  mathHook?: SearchMathHook;
}

const NAME_BY_ID = new Map(pokedex.map((p) => [p.id, p.name]));

/** Display name (real spelling, for the target card). */
export function searchPokemonName(id: number): string {
  return NAME_BY_ID.get(id) ?? "Pokémon";
}

/** Pages this profile plays, gentlest first. 3yo: tiers 1-2 only. */
export function pagesForAge(is3yo: boolean): SearchPage[] {
  const pages = is3yo ? searchPages.filter((p) => p.difficulty <= 2) : searchPages.slice();
  return pages.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Spoken lines — the page speaks EXACTLY these strings, and warm-tts warms
// exactly these strings (rocket's byte-stability contract). hint_text comes
// from the generated pages, so it is enumerable too.
// ---------------------------------------------------------------------------

export const SEARCH_DONE_LINE = "Amazing! You have super seeker eyes!";
export const SEARCH_SESSION_DONE_LINE = "Incredible searching! You found every hidden friend!";
export const SEARCH_MATH_LINE = "Solve this puzzle to power up the magnifying glass!";
export const SEARCH_MATH_SOLVED_LINE = "Great job! The magnifying glass shows the way!";

/** Spoken when a page opens: who to look for. */
export function findTargetLine(id: number): string {
  return `Can you find ${spokenName(searchPokemonName(id))}? Look closely!`;
}

/** Spoken when the target is tapped. */
export function foundTargetLine(id: number): string {
  return `You found ${spokenName(searchPokemonName(id))}!`;
}

export function allSearchSpokenLines(): string[] {
  const lines: string[] = [
    SEARCH_DONE_LINE,
    SEARCH_SESSION_DONE_LINE,
    SEARCH_MATH_LINE,
    SEARCH_MATH_SOLVED_LINE,
  ];
  const targetIds = new Set<number>();
  for (const page of searchPages) {
    targetIds.add(page.target.species);
    lines.push(page.hintText);
  }
  for (const id of targetIds) {
    lines.push(findTargetLine(id));
    lines.push(foundTargetLine(id));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Math-hook problem instantiation — template-based, mirrors the math page's
// approach (never LLM). Answer choices are all >= 0 and unambiguous.
// ---------------------------------------------------------------------------

export interface HookProblem {
  prompt: string; // e.g. "3 + 4 = ?"
  choices: number[]; // 3 options, one correct
  answer: number;
  /** For "count": how many sprites to show (prompt stays visual). */
  countSprites?: number;
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function makeHookProblem(hook: SearchMathHook): HookProblem {
  let a: number, b: number, answer: number, prompt: string;
  let countSprites: number | undefined;
  switch (hook.skill) {
    case "count":
      answer = randInt(2, hook.max);
      countSprites = answer;
      prompt = "How many Pokémon?";
      break;
    case "add":
      a = randInt(1, hook.max - 1);
      b = randInt(1, hook.max - a);
      answer = a + b;
      prompt = `${a} + ${b} = ?`;
      break;
    case "subtract":
      a = randInt(2, hook.max);
      b = randInt(1, a - 1);
      answer = a - b;
      prompt = `${a} - ${b} = ?`;
      break;
    case "multiply":
      a = randInt(2, Math.min(hook.max, 9));
      b = randInt(2, Math.min(hook.max, 9));
      answer = a * b;
      prompt = `${a} × ${b} = ?`;
      break;
  }
  const choices = new Set<number>([answer]);
  while (choices.size < 3) {
    const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
    const c = answer + delta;
    if (c >= 0 && c !== answer) choices.add(c);
  }
  return {
    prompt,
    answer,
    countSprites,
    choices: Array.from(choices).sort(() => Math.random() - 0.5),
  };
}
