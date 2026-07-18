import type { GeoSceneKind } from "@/components/GeoScene";

export interface PokemonHabitat {
  biome: string;
  climate: string;
  examplePlace: string;
  scene: GeoSceneKind;
  note: string;
}

const TYPE_HABITATS: Record<string, PokemonHabitat> = {
  Grass: {
    biome: "Forest or rainforest",
    climate: "Warm and wet",
    examplePlace: "Amazon Rainforest",
    scene: "rainforest",
    note: "Grass types fit places with lots of plants, rain, and sunshine.",
  },
  Fire: {
    biome: "Dry grassland or volcano",
    climate: "Hot and dry",
    examplePlace: "Savanna",
    scene: "savanna",
    note: "Fire types fit warm places with lots of heat.",
  },
  Water: {
    biome: "Ocean, river, or pond",
    climate: "Wet",
    examplePlace: "Pacific Ocean",
    scene: "ocean",
    note: "Water types fit places with lakes, rivers, or oceans.",
  },
  Ice: {
    biome: "Snowy land",
    climate: "Cold",
    examplePlace: "Antarctica",
    scene: "antarctica",
    note: "Ice types fit cold places with snow and ice.",
  },
  Rock: {
    biome: "Mountain",
    climate: "Rocky",
    examplePlace: "Rocky Mountains",
    scene: "mountain",
    note: "Rock types fit cliffs, caves, and mountains.",
  },
  Ground: {
    biome: "Desert or dry plain",
    climate: "Dry",
    examplePlace: "Sahara Desert",
    scene: "desert",
    note: "Ground types fit sandy, dusty, or muddy places.",
  },
  Bug: {
    biome: "Forest",
    climate: "Warm",
    examplePlace: "Rainforest",
    scene: "forest",
    note: "Bug types fit places with leaves, trees, and tiny hiding spots.",
  },
  Electric: {
    biome: "Grassland during storms",
    climate: "Stormy",
    examplePlace: "Open grassland",
    scene: "grassland",
    note: "Electric types fit open places where lightning and energy are easy to imagine.",
  },
  Flying: {
    biome: "Mountains and open sky",
    climate: "Windy",
    examplePlace: "Mountain cliffs",
    scene: "mountain",
    note: "Flying types fit places with room to soar.",
  },
  Poison: {
    biome: "Swamp or damp forest",
    climate: "Wet",
    examplePlace: "Wet forest",
    scene: "rainforest",
    note: "Poison types fit damp places with mushrooms, vines, and hidden plants.",
  },
  Fairy: {
    biome: "Flower field or forest",
    climate: "Mild",
    examplePlace: "Green meadow",
    scene: "grassland",
    note: "Fairy types fit gentle places with flowers and soft grass.",
  },
  Ghost: {
    biome: "Cave or dark forest",
    climate: "Cool and dark",
    examplePlace: "Cave",
    scene: "cave",
    note: "Ghost types fit dark, quiet places like caves.",
  },
  Normal: {
    biome: "Grassland or forest edge",
    climate: "Mild",
    examplePlace: "Open field",
    scene: "grassland",
    note: "Normal types fit everyday habitats like fields and forest edges.",
  },
};

const OVERRIDES: Record<number, PokemonHabitat> = {
  1: {
    biome: "Rainforest floor",
    climate: "Warm and wet",
    examplePlace: "Amazon Rainforest",
    scene: "rainforest",
    note: "Bulbasaur has a plant bulb, so a wet rainforest is a good real-world habitat idea.",
  },
  4: {
    biome: "Dry rocky hillside",
    climate: "Hot and dry",
    examplePlace: "Savanna",
    scene: "savanna",
    note: "Charmander's flame fits warm, dry places.",
  },
  7: {
    biome: "Pond or beach",
    climate: "Wet",
    examplePlace: "Ocean shore",
    scene: "ocean",
    note: "Squirtle fits places with water nearby.",
  },
  25: {
    biome: "Open grassland",
    climate: "Stormy",
    examplePlace: "Grassland",
    scene: "grassland",
    note: "Pikachu's electricity is easy to connect with open stormy places.",
  },
  145: {
    biome: "Stormy mountain sky",
    climate: "Windy and stormy",
    examplePlace: "Mountain cliffs",
    scene: "mountain",
    note: "Zapdos is an Electric and Flying type, so it connects with storm clouds over tall mountains.",
  },
  448: {
    biome: "Mountain meadow",
    climate: "Cool and open",
    examplePlace: "Mountain grassland",
    scene: "mountain",
    note: "Lucario fits open rocky places where it can run and train.",
  },
  778: {
    biome: "Cave or shadowy forest",
    climate: "Cool and dark",
    examplePlace: "Cave",
    scene: "cave",
    note: "Mimikyu fits quiet, dark places where it can hide.",
  },
  882: {
    biome: "Rocky ocean shore",
    climate: "Wet and windy",
    examplePlace: "Ocean shore",
    scene: "ocean",
    note: "Dracovish is a Water and Dragon type, so it connects with ancient seas and rocky shores.",
  },
};

export function getPokemonHabitat(id: number, types: string[]): PokemonHabitat {
  if (OVERRIDES[id]) return OVERRIDES[id];
  for (const type of types) {
    if (TYPE_HABITATS[type]) return TYPE_HABITATS[type];
  }
  return TYPE_HABITATS["Normal"];
}
