export interface Math3YoQuestion {
  id: string;
  type: "count" | "add" | "subtract";
  pokemonId: number;
  pokemonName: string;
  count?: number;
  a?: number;
  b?: number;
  answer: number;
  choices: number[];
}

const POKEMON = [
  { id: 25, name: "Pikachu" },
  { id: 39, name: "Jigglypuff" },
  { id: 133, name: "Eevee" },
  { id: 175, name: "Togepi" },
  { id: 54, name: "Psyduck" },
  { id: 7, name: "Squirtle" },
  { id: 1, name: "Bulbasaur" },
  { id: 4, name: "Charmander" },
];

const p = (idx: number) => POKEMON[idx % POKEMON.length];

function choicesAround(answer: number, min = 0, max = 10): number[] {
  const choices = new Set<number>([answer]);
  for (let offset = 1; choices.size < 3 && offset <= max + 3; offset++) {
    if (answer - offset >= min) choices.add(answer - offset);
    if (choices.size < 3 && answer + offset <= max)
      choices.add(answer + offset);
  }
  return [...choices].sort((a, b) => a - b);
}

const questions: Math3YoQuestion[] = [];

POKEMON.forEach((pokemon) => {
  for (let count = 1; count <= 8; count++) {
    questions.push({
      id: `count-${pokemon.id}-${count}`,
      type: "count",
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      count,
      answer: count,
      choices: choicesAround(count),
    });
  }
});

for (let a = 0; a <= 5; a++) {
  for (let b = 0; b <= 5; b++) {
    const answer = a + b;
    if (answer < 1 || answer > 9) continue;
    const pokemon = p(questions.length);
    questions.push({
      id: `add-${a}-${b}`,
      type: "add",
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      a,
      b,
      answer,
      choices: choicesAround(answer),
    });
  }
}

for (let a = 1; a <= 9; a++) {
  for (let b = 0; b <= a; b++) {
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
      choices: choicesAround(answer),
    });
  }
}

export const math3YoQuestions: Math3YoQuestion[] = questions;

export function getQuestionPrompt(q: Math3YoQuestion): string {
  if (q.type === "count") return `How many ${q.pokemonName}?`;
  if (q.type === "add") return `${q.a} + ${q.b} = ?`;
  return `${q.a} - ${q.b} = ?`;
}
