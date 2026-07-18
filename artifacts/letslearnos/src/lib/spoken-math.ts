// ---------------------------------------------------------------------------
// spoken-math.ts — Pure spoken-string builders for the Math module.
//
// Extracted from src/pages/math.tsx so the warm-tts script (and any future
// tooling) can enumerate all TTS phrases without importing React or browser
// APIs.  math.tsx re-imports these instead of defining them locally.
//
// NO React, NO browser APIs, NO dynamic imports — fully importable by Node/tsx.
// ---------------------------------------------------------------------------
import type { Math3YoQuestion } from "@/content/math-3yo";
import type { Math5YoQuestion } from "@/content/math-5yo";

export type AnyQuestion = Math3YoQuestion | Math5YoQuestion;

// ---------------------------------------------------------------------------
// POKEMON_POOL — the session Pokémon roster used by the math page.
// Exported here so the warm script can iterate every pool entry.
// ---------------------------------------------------------------------------
export const POKEMON_POOL: Array<{ id: number; name: string }> = [
  { id: 25, name: "Pikachu" },
  { id: 39, name: "Jigglypuff" },
  { id: 133, name: "Eevee" },
  { id: 175, name: "Togepi" },
  { id: 54, name: "Psyduck" },
  { id: 7, name: "Squirtle" },
  { id: 1, name: "Bulbasaur" },
  { id: 4, name: "Charmander" },
  { id: 52, name: "Meowth" },
  { id: 143, name: "Snorlax" },
  { id: 35, name: "Clefairy" },
  { id: 79, name: "Slowpoke" },
  { id: 172, name: "Pichu" },
  { id: 37, name: "Vulpix" },
  { id: 113, name: "Chansey" },
  { id: 58, name: "Growlithe" },
  { id: 92, name: "Gastly" },
  { id: 60, name: "Poliwag" },
];

// ---------------------------------------------------------------------------
// Spoken (TTS) version of each question — symbols verbalised for the voice.
// ---------------------------------------------------------------------------
export function getSpokenQuestion(
  q: AnyQuestion,
  pokemonName: string,
  is3yo: boolean,
): string {
  const q3 = q as Math3YoQuestion;
  const q5 = q as Math5YoQuestion;

  if (is3yo) {
    if (q3.type === "count")
      return `How many ${pokemonName} do you see? Count them!`;
    if (q3.type === "add")
      return `${q3.a} ${pokemonName} plus ${q3.b} ${pokemonName}. How many altogether?`;
    return `${q3.a} ${pokemonName}, take away ${q3.b}. How many are left?`;
  }
  if (q5.type === "word") return q5.wordProblem ?? "";
  if (q5.type === "add") return `What is ${q.a} plus ${q.b}?`;
  if (q5.type === "subtract") return `What is ${q.a} minus ${q.b}?`;
  return `What is ${q5.a} times ${q5.b}?`;
}

// ---------------------------------------------------------------------------
// The wrong-answer explanation itself (ADR-011: step-by-step, common-core
// strategies, spoken + visual) now lives in src/content/math-explain.ts —
// getExplanation() there returns the full multi-line narration used by the
// ExplanationOverlay in math.tsx. This module keeps only the "read the
// question aloud" builder above.
// ---------------------------------------------------------------------------
