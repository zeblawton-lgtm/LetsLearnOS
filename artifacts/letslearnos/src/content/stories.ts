// ---------------------------------------------------------------------------
// Picture Stories for the Story Time activity (route /stories).
//
// Every id below is verified against the bundled 1..1025 dex
// (src/content/pokedex.ts) and is a well-known, kid-friendly Pokémon.
// Text is hand-edited to read like a real picture book: present tense,
// 1-2 short sentences per page, warm/positive endings that vary from story
// to story (no repeated "waves goodbye" formula).
// ---------------------------------------------------------------------------

export type StoryScene =
  | "forest"
  | "beach"
  | "mountain"
  | "meadow"
  | "night"
  | "snow"
  | "pond";

export interface StoryPage {
  /** 1-2 simple, present-tense sentences. */
  text: string;
  /** Sprite ids shown big on this page, in display order (1-3 entries). */
  pokemonIds: number[];
  scene: StoryScene;
}

export interface Story {
  id: number;
  title: string;
  /** Well-known id shown on the cover tile. */
  coverPokemonId: number;
  pages: StoryPage[];
}

export const stories: Story[] = [
  {
    id: 1,
    title: "Pikachu's Sunny Picnic",
    coverPokemonId: 25,
    pages: [
      {
        text: "Pikachu skips through the sunny meadow, looking for a good picnic spot.",
        pokemonIds: [25],
        scene: "meadow",
      },
      {
        text: "Eevee bounds over with a basket of berries. “Want to share?” asks Eevee.",
        pokemonIds: [25, 133],
        scene: "meadow",
      },
      {
        text: "Butterfree flutters down and sprinkles the blanket with sparkly petals.",
        pokemonIds: [25, 133, 12],
        scene: "meadow",
      },
      {
        text: "The three friends munch berries and watch fluffy clouds drift by.",
        pokemonIds: [25, 133, 12],
        scene: "meadow",
      },
      {
        text: "Full and happy, they curl up together for a warm meadow nap.",
        pokemonIds: [25, 133, 12],
        scene: "meadow",
      },
    ],
  },
  {
    id: 2,
    title: "Jigglypuff's Lullaby",
    coverPokemonId: 39,
    pages: [
      {
        text: "Jigglypuff hums a soft, bouncy tune under the tall forest trees.",
        pokemonIds: [39],
        scene: "forest",
      },
      {
        text: "Caterpie wiggles closer to listen, curling into a cozy ball.",
        pokemonIds: [39, 10],
        scene: "forest",
      },
      {
        text: "Pidgey glides down and tucks her wings in tight beside them.",
        pokemonIds: [39, 10, 16],
        scene: "forest",
      },
      {
        text: "The forest grows quiet as the very first star twinkles overhead.",
        pokemonIds: [39, 10, 16],
        scene: "night",
      },
      {
        text: "Jigglypuff sings one more soft note, and everyone drifts off to sleep.",
        pokemonIds: [39, 10, 16],
        scene: "night",
      },
    ],
  },
  {
    id: 3,
    title: "Squirtle's Beach Day",
    coverPokemonId: 7,
    pages: [
      {
        text: "Squirtle races down the beach and splashes into the cool waves.",
        pokemonIds: [7],
        scene: "beach",
      },
      {
        text: "Psyduck waddles over with a bright red pail. “Let's build a castle!”",
        pokemonIds: [7, 54],
        scene: "beach",
      },
      {
        text: "Staryu spins through the shallow water, leaving sparkly ripples behind.",
        pokemonIds: [7, 54, 120],
        scene: "beach",
      },
      {
        text: "Together they pile up sand for the tallest tower on the beach.",
        pokemonIds: [7, 54, 120],
        scene: "beach",
      },
      {
        text: "As the sky turns pink and gold, the friends clap for their castle.",
        pokemonIds: [7, 54, 120],
        scene: "beach",
      },
    ],
  },
  {
    id: 4,
    title: "Clefairy's Snowy Day",
    coverPokemonId: 35,
    pages: [
      {
        text: "Clefairy hops through the fresh snow, leaving little star-shaped tracks.",
        pokemonIds: [35],
        scene: "snow",
      },
      {
        text: "Vulpix trots up beside her, six fluffy tails swishing through the snow.",
        pokemonIds: [35, 37],
        scene: "snow",
      },
      {
        text: "Snorlax rolls a giant snowball for the middle of their new snow friend.",
        pokemonIds: [35, 37, 143],
        scene: "snow",
      },
      {
        text: "They pat on two pebble eyes and a little carrot nose. A snow pal!",
        pokemonIds: [35, 37, 143],
        scene: "snow",
      },
      {
        text: "The three friends cheer and share warm cocoa to celebrate.",
        pokemonIds: [35, 37, 143],
        scene: "snow",
      },
    ],
  },
  {
    id: 5,
    title: "Bulbasaur's Pond Adventure",
    coverPokemonId: 1,
    pages: [
      {
        text: "Bulbasaur tiptoes to the edge of the quiet, glassy pond.",
        pokemonIds: [1],
        scene: "pond",
      },
      {
        text: "Horsea peeks up from the water and blows a tiny bubble hello.",
        pokemonIds: [1, 116],
        scene: "pond",
      },
      {
        text: "Poliwag joins in, swirling circles that ripple across the water.",
        pokemonIds: [1, 116, 60],
        scene: "pond",
      },
      {
        text: "Dragonflies zip and dance above the lily pads in the warm sun.",
        pokemonIds: [1, 116, 60],
        scene: "pond",
      },
      {
        text: "Bulbasaur dips a leaf in the cool water and smiles at his new friends.",
        pokemonIds: [1, 116, 60],
        scene: "pond",
      },
    ],
  },
  {
    id: 6,
    title: "Charmander's Mountain Hike",
    coverPokemonId: 4,
    pages: [
      {
        text: "Charmander climbs the winding mountain path, his tail flame flickering brightly.",
        pokemonIds: [4],
        scene: "mountain",
      },
      {
        text: "Geodude rolls up beside him and helps him over a big smooth rock.",
        pokemonIds: [4, 74],
        scene: "mountain",
      },
      {
        text: "Ponyta trots alongside, her mane glowing like the morning sun.",
        pokemonIds: [4, 74, 77],
        scene: "mountain",
      },
      {
        text: "At the top, they sit on a sunny ledge and look out at the wide blue sky.",
        pokemonIds: [4, 74, 77],
        scene: "mountain",
      },
      {
        text: "“We made it together!” cheers Charmander, and everyone cheers too.",
        pokemonIds: [4, 74, 77],
        scene: "mountain",
      },
    ],
  },
  {
    id: 7,
    title: "Eevee's Forest Friends",
    coverPokemonId: 133,
    pages: [
      {
        text: "Eevee twirls between sunbeams in the quiet green forest.",
        pokemonIds: [133],
        scene: "forest",
      },
      {
        text: "Chikorita peeks out from behind a leaf and giggles at the twirls.",
        pokemonIds: [133, 152],
        scene: "forest",
      },
      {
        text: "Caterpie inches over, and the three start a game of hide-and-seek.",
        pokemonIds: [133, 152, 10],
        scene: "forest",
      },
      {
        text: "Eevee counts to five with her eyes closed tight, tail wagging with excitement.",
        pokemonIds: [133, 152, 10],
        scene: "forest",
      },
      {
        text: "“Found you!” Eevee laughs, and they all tumble together in a happy hug.",
        pokemonIds: [133, 152, 10],
        scene: "forest",
      },
    ],
  },
  {
    id: 8,
    title: "Charmeleon's Try-Again Day",
    coverPokemonId: 5,
    pages: [
      {
        text: "Charmeleon spots a tall grassy hill and decides to climb all the way up.",
        pokemonIds: [5],
        scene: "meadow",
      },
      {
        text: "He takes a big step, wobbles on the dewy grass, and giggles as he tumbles down.",
        pokemonIds: [5],
        scene: "meadow",
      },
      {
        text: "Charmander scrambles over with a grin. “Let's climb together this time!”",
        pokemonIds: [5, 4],
        scene: "meadow",
      },
      {
        text: "Side by side, the two climb slowly, one careful step at a time.",
        pokemonIds: [5, 4],
        scene: "meadow",
      },
      {
        text: "At the top, they throw their arms up. “We did it — teamwork!”",
        pokemonIds: [5, 4],
        scene: "meadow",
      },
    ],
  },
];
