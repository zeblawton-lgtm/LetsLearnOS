export interface Math5YoQuestion {
  id: string;
  type: "add" | "subtract" | "multiply" | "word";
  pokemonId: number;
  pokemonName: string;
  a?: number;
  b?: number;
  wordProblem?: string;
  /**
   * Explicit strategy hint for word problems (ADR-011 wrong-answer
   * explanations) — set only on `type: "word"` questions. Lets the
   * explanation templates pick the right common-core strategy (counting-on /
   * counting-back / skip-counting) directly instead of guessing it from
   * keywords in the problem text.
   */
  operation?: "add" | "subtract" | "multiply";
  answer: number;
  choices: number[];
}

const POKEMON = [
  { id: 25, name: "Pikachu" },
  { id: 133, name: "Eevee" },
  { id: 39, name: "Jigglypuff" },
  { id: 143, name: "Snorlax" },
  { id: 7, name: "Squirtle" },
  { id: 1, name: "Bulbasaur" },
  { id: 4, name: "Charmander" },
  { id: 52, name: "Meowth" },
];

const p = (idx: number) => POKEMON[idx % POKEMON.length];

function choicesAround(answer: number, seed: number, min = 0): number[] {
  const patterns = [
    [-1, 1],
    [-2, 1],
    [-1, 2],
    [-3, 2],
    [-2, 3],
  ];
  const choices = new Set<number>([answer]);
  for (const offset of patterns[seed % patterns.length]) {
    const value = answer + offset;
    if (value >= min) choices.add(value);
  }
  for (let offset = 1; choices.size < 3; offset++) {
    if (answer - offset >= min) choices.add(answer - offset);
    if (choices.size < 3) choices.add(answer + offset);
  }
  return [...choices].sort((a, b) => a - b);
}

const questions: Math5YoQuestion[] = [];

for (let a = 2; a <= 14; a++) {
  for (let b = 2; b <= 14; b++) {
    const answer = a + b;
    const pokemon = p(questions.length);
    questions.push({
      id: `add-${a}-${b}`,
      type: "add",
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      a,
      b,
      answer,
      choices: choicesAround(answer, questions.length),
    });
  }
}

for (let a = 6; a <= 24; a++) {
  for (let b = 1; b <= Math.min(12, a); b++) {
    const answer = a - b;
    const pokemon = p(questions.length);
    questions.push({
      id: `sub-${a}-${b}`,
      type: "subtract",
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      a,
      b,
      answer,
      choices: choicesAround(answer, questions.length),
    });
  }
}

for (let a = 2; a <= 9; a++) {
  for (let b = 2; b <= 9; b++) {
    const answer = a * b;
    const pokemon = p(questions.length);
    questions.push({
      id: `mul-${a}-${b}`,
      type: "multiply",
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      a,
      b,
      answer,
      choices: choicesAround(answer, questions.length),
    });
  }
}

const wordItems = [
  "berries",
  "stickers",
  "shells",
  "coins",
  "flowers",
  "stars",
  "apples",
  "blocks",
];

POKEMON.forEach((pokemon, pokemonIndex) => {
  const addA = 4 + pokemonIndex;
  const addB = 3 + (pokemonIndex % 5);
  const subtractA = 10 + pokemonIndex;
  const subtractB = 2 + (pokemonIndex % 6);
  const groups = 2 + (pokemonIndex % 4);
  const each = 3 + (pokemonIndex % 5);
  const item = wordItems[pokemonIndex % wordItems.length];

  questions.push({
    id: `word-add-${pokemon.id}`,
    type: "word",
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    wordProblem: `${pokemon.name} found ${addA} ${item}, then found ${addB} more. How many ${item} altogether?`,
    operation: "add",
    answer: addA + addB,
    choices: choicesAround(addA + addB, questions.length),
  });

  questions.push({
    id: `word-sub-${pokemon.id}`,
    type: "word",
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    wordProblem: `${pokemon.name} had ${subtractA} ${item} and shared ${subtractB}. How many ${item} are left?`,
    operation: "subtract",
    answer: subtractA - subtractB,
    choices: choicesAround(subtractA - subtractB, questions.length),
  });

  questions.push({
    id: `word-mul-${pokemon.id}`,
    type: "word",
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    wordProblem: `${pokemon.name} made ${groups} groups with ${each} ${item} in each group. How many ${item} total?`,
    operation: "multiply",
    answer: groups * each,
    choices: choicesAround(groups * each, questions.length),
  });
});

export const math5YoQuestions: Math5YoQuestion[] = questions;

export function getQuestionPrompt(q: Math5YoQuestion): string {
  if (q.type === "word") return q.wordProblem!;
  if (q.type === "add") return `${q.a} + ${q.b} = ?`;
  if (q.type === "subtract") return `${q.a} − ${q.b} = ?`;
  return `${q.a} × ${q.b} = ?`;
}
