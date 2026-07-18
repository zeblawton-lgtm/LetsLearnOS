export interface SouthAmericaCountryFact {
  code: string;
  name: string;
  capital: string;
  emoji: string; // decorative, shown on the info card
  fact: string;
}

export const southAmericaCountries: SouthAmericaCountryFact[] = [
  {
    code: "CO",
    name: "Colombia",
    capital: "Bogotá",
    emoji: "🦜",
    fact: "Colombia has rainforest, mountains, and colorful birds like parrots.",
  },
  {
    code: "VE",
    name: "Venezuela",
    capital: "Caracas",
    emoji: "🏞️",
    fact: "Venezuela has Angel Falls, the tallest waterfall in the whole world!",
  },
  {
    code: "GY",
    name: "Guyana",
    capital: "Georgetown",
    emoji: "🦦",
    fact: "Guyana is covered in rainforest and is home to giant otters and jaguars.",
  },
  {
    code: "SR",
    name: "Suriname",
    capital: "Paramaribo",
    emoji: "🛶",
    fact: "Suriname has wide rivers and a rich mix of cultures and languages.",
  },
  {
    code: "GF",
    name: "French Guiana",
    capital: "Cayenne",
    emoji: "🇫🇷",
    fact: "French Guiana is part of France, way over on the other side of the ocean!",
  },
  {
    code: "EC",
    name: "Ecuador",
    capital: "Quito",
    emoji: "🐢",
    fact: "Ecuador is home to the Galápagos Islands and sits right on the equator.",
  },
  {
    code: "PE",
    name: "Peru",
    capital: "Lima",
    emoji: "🏔️",
    fact: "Peru has Machu Picchu, ancient stone ruins high up in the mountains.",
  },
  {
    code: "BR",
    name: "Brazil",
    capital: "Brasília",
    emoji: "🌳",
    fact: "Brazil is home to most of the Amazon rainforest and the mighty Amazon River.",
  },
  {
    code: "BO",
    name: "Bolivia",
    capital: "La Paz",
    emoji: "🧂",
    fact: "Bolivia has the world's largest salt flat, called Salar de Uyuni.",
  },
  {
    code: "PY",
    name: "Paraguay",
    capital: "Asunción",
    emoji: "🌵",
    fact: "Paraguay has lush forests and a dry, wild region called the Chaco.",
  },
  {
    code: "UY",
    name: "Uruguay",
    capital: "Montevideo",
    emoji: "🏖️",
    fact: "Uruguay is famous for its sunny beaches and friendly people.",
  },
  {
    code: "CL",
    name: "Chile",
    capital: "Santiago",
    emoji: "🧊",
    fact: "Chile is a very long, skinny country stretching from desert to icy glaciers.",
  },
  {
    code: "AR",
    name: "Argentina",
    capital: "Buenos Aires",
    emoji: "💃",
    fact: "Argentina is famous for tango dancing and wide open grasslands.",
  },
];

// The small Guiana coast countries and thin southern-cone countries are too
// small to be honest 88px touch targets, so they get side buttons instead.
export const SMALL_COUNTRIES = ["GY", "SR", "GF", "UY", "EC"];
