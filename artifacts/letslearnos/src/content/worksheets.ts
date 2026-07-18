// ---------------------------------------------------------------------------
// Printable worksheet packets (parent feature, behind the PIN).
//
// All content is template-based and generated from a seed so every print run
// is a fresh packet (AGENTS.md: math is templates, never LLM-generated).
// Rendering lives in pages/worksheets.tsx; this module is pure data.
// ---------------------------------------------------------------------------

export interface WsPokemon {
  id: number;
  name: string;
}

const POKEMON: WsPokemon[] = [
  { id: 25, name: "Pikachu" },
  { id: 133, name: "Eevee" },
  { id: 7, name: "Squirtle" },
  { id: 4, name: "Charmander" },
  { id: 1, name: "Bulbasaur" },
  { id: 39, name: "Jigglypuff" },
  { id: 143, name: "Snorlax" },
  { id: 52, name: "Meowth" },
  { id: 54, name: "Psyduck" },
  { id: 129, name: "Magikarp" },
  { id: 35, name: "Clefairy" },
  { id: 175, name: "Togepi" },
];

// Deterministic PRNG so a packet can be regenerated from its seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled<T>(rng: () => number, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sheet shapes
// ---------------------------------------------------------------------------

export interface ArithmeticProblem {
  a: number;
  b: number;
  op: "+" | "-";
  answer: number;
  pokemonId: number;
}

export interface WordProblem {
  text: string;
  answer: number;
  pokemonId: number;
}

export interface CountingRow {
  pokemon: WsPokemon;
  count: number;
  choices: number[];
}

export interface TraceWordRow {
  word: string;
  pokemonId: number;
}

export interface CircleGrid {
  prompt: string;
  targetPokemonId: number;
  cells: number[]; // pokemon ids laid out in a grid
  targetCount: number;
}

export interface MatchPair {
  pokemon: WsPokemon;
  count: number;
}

export interface ReadingQuestion {
  q: string;
  choices: string[];
  answerIndex: number;
}

export interface ReadingPassage {
  title: string;
  pokemonId: number;
  sentences: string[];
  questions: ReadingQuestion[];
}

export type Sheet =
  | { kind: "arithmetic"; title: string; problems: ArithmeticProblem[]; wordProblems: WordProblem[] }
  | { kind: "counting"; title: string; rows: CountingRow[] }
  | { kind: "trace-words"; title: string; rows: TraceWordRow[] }
  | { kind: "trace-glyphs"; title: string; lines: string[] }
  | { kind: "circle-find"; title: string; grids: CircleGrid[] }
  | { kind: "match-count"; title: string; pairs: MatchPair[]; numbers: number[] }
  | { kind: "reading"; title: string; passage: ReadingPassage }
  | { kind: "answer-key"; title: string; entries: { section: string; answers: string[] }[] };

export interface Packet {
  kidName: string;
  age: number;
  seed: number;
  sheets: Sheet[];
}

// ---------------------------------------------------------------------------
// Word-problem templates (5yo)
// ---------------------------------------------------------------------------

interface WpTemplate {
  op: "+" | "-";
  text: (p1: string, p2: string, a: number, b: number) => string;
}

const WORD_TEMPLATES: WpTemplate[] = [
  {
    op: "+",
    text: (p1, p2, a, b) =>
      `${p1} has ${a} berries. ${p2} gives ${p1} ${b} more berries. How many berries does ${p1} have now?`,
  },
  {
    op: "+",
    text: (p1, p2, a, b) =>
      `${p1} finds ${a} Poké Balls. ${p2} finds ${b} Poké Balls. How many Poké Balls did they find together?`,
  },
  {
    op: "-",
    text: (p1, _p2, a, b) =>
      `${p1} has ${a} apples. ${p1} eats ${b} of them. How many apples are left?`,
  },
  {
    op: "-",
    text: (p1, p2, a, b) =>
      `${p1} has ${a} stickers. ${p1} gives ${b} stickers to ${p2}. How many stickers does ${p1} keep?`,
  },
];

// ---------------------------------------------------------------------------
// Reading passages (5yo, kindergarten sight words)
// ---------------------------------------------------------------------------

const PASSAGES: ReadingPassage[] = [
  {
    title: "Pikachu Runs",
    pokemonId: 25,
    sentences: [
      "Pikachu is a yellow Pokémon.",
      "He can run very fast.",
      "He likes to eat red berries.",
      "His best friend is Eevee.",
      "They play in the sun all day.",
    ],
    questions: [
      { q: "What color is Pikachu?", choices: ["yellow", "blue", "green"], answerIndex: 0 },
      { q: "What does Pikachu like to eat?", choices: ["rocks", "red berries", "leaves"], answerIndex: 1 },
      { q: "Who is his best friend?", choices: ["Snorlax", "Meowth", "Eevee"], answerIndex: 2 },
    ],
  },
  {
    title: "Squirtle Swims",
    pokemonId: 7,
    sentences: [
      "Squirtle is a little blue Pokémon.",
      "He has a hard shell on his back.",
      "He loves to swim in the lake.",
      "He can squirt water very far.",
      "At night he sleeps in his shell.",
    ],
    questions: [
      { q: "What color is Squirtle?", choices: ["red", "blue", "pink"], answerIndex: 1 },
      { q: "Where does he love to swim?", choices: ["in the lake", "in the tub", "in the sky"], answerIndex: 0 },
      { q: "Where does he sleep?", choices: ["in a bed", "in a tree", "in his shell"], answerIndex: 2 },
    ],
  },
  {
    title: "Snorlax Naps",
    pokemonId: 143,
    sentences: [
      "Snorlax is a big Pokémon.",
      "He likes to eat and eat.",
      "Then he takes a long nap.",
      "He sleeps by the big tree.",
      "Shh! Do not wake Snorlax up.",
    ],
    questions: [
      { q: "Is Snorlax big or little?", choices: ["big", "little", "tiny"], answerIndex: 0 },
      { q: "What does he do after he eats?", choices: ["he runs", "he takes a nap", "he swims"], answerIndex: 1 },
      { q: "Where does he sleep?", choices: ["by the big tree", "in a car", "on a boat"], answerIndex: 0 },
    ],
  },
  {
    title: "Charmander's Light",
    pokemonId: 4,
    sentences: [
      "Charmander has a flame on his tail.",
      "The flame glows at night.",
      "It helps his friends see in the dark.",
      "Charmander is brave and kind.",
      "His friends like to walk with him.",
    ],
    questions: [
      { q: "Where is Charmander's flame?", choices: ["on his nose", "on his tail", "on his foot"], answerIndex: 1 },
      { q: "When does the flame glow?", choices: ["at night", "at lunch", "never"], answerIndex: 0 },
      { q: "Charmander is brave and…", choices: ["mean", "sleepy", "kind"], answerIndex: 2 },
    ],
  },
  {
    title: "Eevee's Day",
    pokemonId: 133,
    sentences: [
      "Eevee is a soft brown Pokémon.",
      "She likes to dig in the sand.",
      "She found a shiny rock today.",
      "She gave the rock to Pikachu.",
      "Sharing makes Eevee happy.",
    ],
    questions: [
      { q: "What did Eevee find?", choices: ["a shiny rock", "a hat", "a ball"], answerIndex: 0 },
      { q: "Who did she give it to?", choices: ["Meowth", "Pikachu", "Snorlax"], answerIndex: 1 },
      { q: "What makes Eevee happy?", choices: ["napping", "hiding", "sharing"], answerIndex: 2 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function genArithmetic5(rng: () => number): Sheet {
  const problems: ArithmeticProblem[] = [];
  const seen = new Set<string>();
  while (problems.length < 12) {
    const op: "+" | "-" = problems.length < 6 ? "+" : "-";
    let a: number, b: number, answer: number;
    if (op === "+") {
      a = pickInt(rng, 2, 10);
      b = pickInt(rng, 1, 9);
      if (a + b > 18) continue;
      answer = a + b;
    } else {
      a = pickInt(rng, 4, 15);
      b = pickInt(rng, 1, Math.min(9, a - 1));
      answer = a - b;
    }
    const key = `${a}${op}${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ a, b, op, answer, pokemonId: POKEMON[problems.length % POKEMON.length].id });
  }

  const wordProblems: WordProblem[] = [];
  const templates = shuffled(rng, WORD_TEMPLATES).slice(0, 2);
  for (const t of templates) {
    const [p1, p2] = shuffled(rng, POKEMON).slice(0, 2);
    const a = pickInt(rng, 4, 9);
    const b = pickInt(rng, 2, Math.min(4, a - 1));
    wordProblems.push({
      text: t.text(p1.name, p2.name, a, b),
      answer: t.op === "+" ? a + b : a - b,
      pokemonId: p1.id,
    });
  }

  return { kind: "arithmetic", title: "Pokémon Math", problems, wordProblems };
}

function genTraceWords(rng: () => number, kidName: string): Sheet {
  // 4 rows total (name + 3 words) — a 5th row overflows the printed page.
  const words = shuffled(rng, POKEMON.filter((p) => p.name.length <= 8)).slice(0, 3);
  const rows: TraceWordRow[] = words.map((p) => ({ word: p.name.toUpperCase(), pokemonId: p.id }));
  // First row is always the kid's own name — the word they practice most.
  rows.unshift({ word: kidName.toUpperCase(), pokemonId: 25 });
  return { kind: "trace-words", title: "Writing Practice", rows };
}

function genReading(rng: () => number): Sheet {
  const passage = PASSAGES[Math.floor(rng() * PASSAGES.length)];
  return { kind: "reading", title: "Reading Time", passage };
}

function genCounting3(rng: () => number): Sheet {
  const mons = shuffled(rng, POKEMON).slice(0, 5);
  const rows: CountingRow[] = mons.map((pokemon, i) => {
    const count = shuffled(rng, [1, 2, 3, 4, 5, 6])[i % 6];
    const wrong = new Set<number>();
    while (wrong.size < 2) {
      const w = pickInt(rng, 1, 7);
      if (w !== count) wrong.add(w);
    }
    return { pokemon, count, choices: shuffled(rng, [count, ...wrong]) };
  });
  return { kind: "counting", title: "Count the Pokémon", rows };
}

function genTraceGlyphs(rng: () => number, kidName: string): Sheet {
  const first = kidName.charAt(0).toUpperCase() || "A";
  const letterPool = "ABCEHLMOST".split("").filter((c) => c !== first);
  const letters = shuffled(rng, letterPool).slice(0, 2);
  const lines = [
    kidName.toUpperCase(),
    `${first} ${first} ${first} ${first}`,
    ...letters.map((l) => `${l} ${l} ${l} ${l}`),
    "1 2 3 4 5",
  ];
  return { kind: "trace-glyphs", title: "Trace and Learn", lines };
}

function genCircleFind(rng: () => number): Sheet {
  const grids: CircleGrid[] = [];
  for (let g = 0; g < 2; g++) {
    const pool = shuffled(rng, POKEMON);
    const target = pool[0];
    const others = pool.slice(1, 4);
    const targetCount = pickInt(rng, 4, 6);
    const cells: number[] = Array.from({ length: targetCount }, () => target.id);
    while (cells.length < 15) cells.push(others[Math.floor(rng() * others.length)].id);
    grids.push({
      prompt: `Circle every ${target.name}!`,
      targetPokemonId: target.id,
      cells: shuffled(rng, cells),
      targetCount,
    });
  }
  return { kind: "circle-find", title: "Find and Circle", grids };
}

function genMatchCount(rng: () => number): Sheet {
  const mons = shuffled(rng, POKEMON).slice(0, 4);
  const counts = shuffled(rng, [1, 2, 3, 4, 5]).slice(0, 4);
  const pairs: MatchPair[] = mons.map((pokemon, i) => ({ pokemon, count: counts[i] }));
  return { kind: "match-count", title: "Match the Numbers", pairs, numbers: shuffled(rng, counts) };
}

function answerKey(sheets: Sheet[]): Sheet | null {
  const entries: { section: string; answers: string[] }[] = [];
  for (const s of sheets) {
    if (s.kind === "arithmetic") {
      entries.push({
        section: "Pokémon Math",
        answers: [
          ...s.problems.map((p, i) => `${i + 1}. ${p.a} ${p.op} ${p.b} = ${p.answer}`),
          ...s.wordProblems.map((w, i) => `Story ${i + 1}: ${w.answer}`),
        ],
      });
    }
    if (s.kind === "reading") {
      entries.push({
        section: `Reading — ${s.passage.title}`,
        answers: s.passage.questions.map(
          (q, i) => `${i + 1}. ${q.choices[q.answerIndex]}`,
        ),
      });
    }
  }
  if (entries.length === 0) return null;
  return { kind: "answer-key", title: "Answer Key (for grown-ups)", entries };
}

export function generatePacket(kidName: string, age: number, seed: number): Packet {
  const rng = mulberry32(seed);
  const sheets: Sheet[] =
    age <= 3
      ? [genCounting3(rng), genTraceGlyphs(rng, kidName), genCircleFind(rng), genMatchCount(rng)]
      : [genArithmetic5(rng), genTraceWords(rng, kidName), genReading(rng)];
  const key = answerKey(sheets);
  if (key) sheets.push(key);
  return { kidName, age, seed, sheets };
}
