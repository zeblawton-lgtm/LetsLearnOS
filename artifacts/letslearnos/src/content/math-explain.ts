// ---------------------------------------------------------------------------
// math-explain.ts — Wrong-answer explanation templates (ADR-011).
//
// Every string here is built from a fixed template + the question's own
// numbers/text. There is NO LLM involved at runtime (see AGENTS.md "What Not
// To Do" and ADR-011's "template-generated ... never LLM-generated"). This
// keeps explanations deterministic, testable offline, and reviewable in a
// diff — the same guarantee the math questions themselves already have.
//
// Pedagogy (owner-approved, ADR-011):
//   - count      -> sequential one-by-one counting (cardinality)
//   - add        -> counting-on from the first addend
//   - subtract   -> counting back from the minuend
//   - multiply   -> equal groups + skip-counting
//   - word       -> restate the problem, name the strategy, state the answer
//
// A first draft of this module was produced by the owner's local model
// (ADR-013) and hand-reviewed here. See the handoff note for what changed.
// ---------------------------------------------------------------------------

import type { AnyQuestion } from "@/lib/spoken-math";
import type { Math3YoQuestion } from "@/content/math-3yo";
import type { Math5YoQuestion } from "@/content/math-5yo";

// ─── Countdown durations (ADR-011: mandatory wait, no skip) ────────────────
// 3yo waits 5s, 5yo waits 10s before the next question unlocks. Named here
// (not inlined in JSX) so there is exactly one place to change them.
export const EXPLANATION_WAIT_SECONDS_3YO = 5;
export const EXPLANATION_WAIT_SECONDS_5YO = 10;

export function explanationWaitSeconds(is3yo: boolean): number {
  return is3yo ? EXPLANATION_WAIT_SECONDS_3YO : EXPLANATION_WAIT_SECONDS_5YO;
}

// Above this many individual counting-on / counting-back / skip-counting
// steps, the narration collapses into a single combined step instead of one
// row + one spoken line per number. Without this, a fact like 14 + 14 would
// produce 14 separate rows and 14 separate TTS utterances — unreadable on
// screen and far longer than the countdown window. See handoff notes.
const STEP_DETAIL_LIMIT = 6;

export type ExplanationVisualType =
  | "count"
  | "add"
  | "subtract"
  | "multiply"
  | "word";

export interface ExplanationStep {
  id: number;
  text: string;
  /** Optional phrase re-emphasized in bold at the end of the line. */
  highlight?: string;
}

export interface ExplanationVisualData {
  a?: number;
  b?: number;
  count?: number;
  wordProblem?: string;
  answer: number;
}

export interface ExplanationResult {
  /** Positive-framing heading — never "wrong"/"incorrect"/"no". */
  title: string;
  /** Sentences to feed to speakSequence(), spoken in order. */
  spokenLines: string[];
  visualType: ExplanationVisualType;
  visualData: ExplanationVisualData;
  steps: ExplanationStep[];
}

// ─── Number to words (0–99) ─────────────────────────────────────────────────
// The question pools top out at 9 x 9 = 81 (multiply) and 24 (subtract), but
// this covers the full two-digit range with a real algorithm rather than a
// lookup table that silently stops (the original draft only went to 24).
const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety",
];

export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const whole = Math.trunc(n);
  const sign = whole < 0 ? "negative " : "";
  const abs = Math.abs(whole);
  if (abs < 20) return sign + ONES[abs];
  if (abs < 100) {
    const tens = Math.floor(abs / 10);
    const ones = abs % 10;
    return sign + TENS[tens] + (ones ? `-${ONES[ones]}` : "");
  }
  // Nothing in the question pools reaches three digits; fall back to digits
  // rather than silently mis-speaking a number we didn't anticipate.
  return sign + String(abs);
}

// ─── Explanation generator ──────────────────────────────────────────────────
// Template-only. No network, no LLM — every string below is composed from
// fixed phrases and the question's own numbers/name.
export function getExplanation(
  q: AnyQuestion,
  is3yo: boolean,
): ExplanationResult {
  switch (q.type) {
    case "count":
      return explainCount(q);
    case "add":
      return explainAdd(q, is3yo);
    case "subtract":
      return explainSubtract(q, is3yo);
    case "multiply":
      return explainMultiply(q);
    case "word":
      return explainWord(q);
    default: {
      // Exhaustiveness guard: a new question `type` won't compile until a
      // branch is added above.
      const _exhaustive: never = q;
      void _exhaustive;
      return {
        title: "Let's try again!",
        visualType: "count",
        visualData: { answer: 0 },
        steps: [],
        spokenLines: [],
      };
    }
  }
}

function explainCount(q: Math3YoQuestion): ExplanationResult {
  const count = q.count ?? 0;
  const name = q.pokemonName;
  const steps: ExplanationStep[] = [];
  for (let i = 1; i <= count; i++) {
    const word = numberToWords(i);
    steps.push({ id: i, text: `${word}...`, highlight: word });
  }
  const totalWord = numberToWords(count);
  steps.push({
    id: count + 1,
    text: `So there are ${totalWord} ${name} altogether!`,
    highlight: totalWord,
  });

  return {
    title: "Let's count them together!",
    visualType: "count",
    visualData: { count, answer: q.answer },
    steps,
    spokenLines: [
      `Let's count the ${name} together!`,
      ...Array.from({ length: count }, (_, i) => `${numberToWords(i + 1)}!`),
      `So there are ${totalWord} ${name} altogether!`,
    ],
  };
}

function explainAdd(q: AnyQuestion, is3yo: boolean): ExplanationResult {
  const aVal = q.a ?? 0;
  const bVal = q.b ?? 0;
  const name = q.pokemonName;
  const answer = q.answer;
  const startWord = numberToWords(aVal);
  const answerWord = numberToWords(answer);

  const steps: ExplanationStep[] = [
    { id: 1, text: `We start with ${startWord} ${name}.`, highlight: startWord },
  ];
  const spokenLines: string[] = [`We start with ${startWord} ${name}.`];

  if (bVal > 0) {
    const countOn = Array.from({ length: bVal }, (_, i) => aVal + i + 1);
    if (bVal <= STEP_DETAIL_LIMIT) {
      countOn.forEach((num, i) => {
        const word = numberToWords(num);
        steps.push({ id: i + 2, text: `Count on: ${word}!`, highlight: word });
        spokenLines.push(`${word}!`);
      });
    } else {
      const list = countOn.map(numberToWords).join(", ");
      const bWord = numberToWords(bVal);
      steps.push({
        id: 2,
        text: `Count on ${bVal} more: ${list}.`,
        highlight: numberToWords(countOn[countOn.length - 1]),
      });
      spokenLines.push(`Count on ${bWord} more: ${list}.`);
    }
  }

  steps.push({
    id: steps.length + 1,
    text: `So ${aVal} plus ${bVal} equals ${answerWord}!`,
    highlight: answerWord,
  });
  spokenLines.push(`So ${aVal} plus ${bVal} equals ${answerWord}!`);

  return {
    title: is3yo ? "Let's count it together!" : "Let's build the sum!",
    visualType: "add",
    visualData: { a: aVal, b: bVal, answer },
    steps,
    spokenLines,
  };
}

function explainSubtract(q: AnyQuestion, is3yo: boolean): ExplanationResult {
  const aVal = q.a ?? 0;
  const bVal = q.b ?? 0;
  const name = q.pokemonName;
  const answer = q.answer;
  const startWord = numberToWords(aVal);
  const answerWord = numberToWords(answer);

  const steps: ExplanationStep[] = [
    { id: 1, text: `We start with ${startWord} ${name}.`, highlight: startWord },
  ];
  const spokenLines: string[] = [`We start with ${startWord} ${name}.`];

  if (bVal > 0) {
    const countBack = Array.from({ length: bVal }, (_, i) => aVal - i - 1);
    if (bVal <= STEP_DETAIL_LIMIT) {
      countBack.forEach((num, i) => {
        const word = numberToWords(num);
        steps.push({ id: i + 2, text: `Count back: ${word}!`, highlight: word });
        spokenLines.push(`${word}!`);
      });
    } else {
      const list = countBack.map(numberToWords).join(", ");
      const bWord = numberToWords(bVal);
      steps.push({
        id: 2,
        text: `Count back ${bVal}: ${list}.`,
        highlight: numberToWords(countBack[countBack.length - 1]),
      });
      spokenLines.push(`Count back ${bWord}: ${list}.`);
    }
  }

  steps.push({
    id: steps.length + 1,
    text: `So ${aVal} take away ${bVal} equals ${answerWord}!`,
    highlight: answerWord,
  });
  spokenLines.push(`So ${aVal} take away ${bVal} equals ${answerWord}!`);

  return {
    title: is3yo ? "Let's count backwards!" : "Let's see what's left!",
    visualType: "subtract",
    visualData: { a: aVal, b: bVal, answer },
    steps,
    spokenLines,
  };
}

function explainMultiply(q: Math5YoQuestion): ExplanationResult {
  const aVal = q.a ?? 0;
  const bVal = q.b ?? 0;
  const answer = q.answer;
  const groupsWord = numberToWords(aVal);
  const eachWord = numberToWords(bVal);
  const answerWord = numberToWords(answer);

  const steps: ExplanationStep[] = [
    {
      id: 1,
      text: `We have ${groupsWord} groups of ${eachWord}.`,
      highlight: groupsWord,
    },
  ];
  const spokenLines: string[] = [`We have ${groupsWord} groups of ${eachWord}.`];

  if (aVal > 0) {
    const running = Array.from({ length: aVal }, (_, i) => bVal * (i + 1));
    if (aVal <= STEP_DETAIL_LIMIT) {
      running.forEach((num, i) => {
        const word = numberToWords(num);
        steps.push({
          id: i + 2,
          text: `${bVal} times ${numberToWords(i + 1)} is ${word}!`,
          highlight: word,
        });
        spokenLines.push(`${bVal} times ${numberToWords(i + 1)} is ${word}!`);
      });
    } else {
      const list = running.map(numberToWords).join(", ");
      steps.push({
        id: 2,
        text: `Skip-count by ${bVal}: ${list}.`,
        highlight: numberToWords(running[running.length - 1]),
      });
      spokenLines.push(`Skip-count by ${eachWord}: ${list}.`);
    }
  }

  steps.push({
    id: steps.length + 1,
    text: `So ${aVal} times ${bVal} equals ${answerWord}!`,
    highlight: answerWord,
  });
  spokenLines.push(`So ${aVal} times ${bVal} equals ${answerWord}!`);

  return {
    title: "Let's see the groups!",
    visualType: "multiply",
    visualData: { a: aVal, b: bVal, answer },
    steps,
    spokenLines,
  };
}

function explainWord(q: Math5YoQuestion): ExplanationResult {
  const problem = q.wordProblem ?? "";
  const answer = q.answer;
  const answerWord = numberToWords(answer);
  // Explicit metadata field (see math-5yo.ts) — no more sniffing the
  // problem text for words like "left"/"each" to guess the operation.
  const operation = q.operation ?? "add";
  const strategyText =
    operation === "subtract"
      ? "We count back to find what's left."
      : operation === "multiply"
        ? "We skip-count to find the total."
        : "We count on to find the total.";

  const steps: ExplanationStep[] = [
    { id: 1, text: `Problem: ${problem}` },
    { id: 2, text: strategyText },
    {
      id: 3,
      text: `The answer is ${answerWord}.`,
      highlight: answerWord,
    },
  ];

  return {
    title: "Let's solve it together!",
    visualType: "word",
    visualData: { wordProblem: problem, answer },
    steps,
    spokenLines: [problem, strategyText, `The answer is ${answerWord}.`],
  };
}
