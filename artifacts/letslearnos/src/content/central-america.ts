export interface CentralAmericaCountryFact {
  code: string;
  name: string;
  capital: string;
  emoji: string; // decorative, shown on the info card
  fact: string;
}

export const centralAmericaCountries: CentralAmericaCountryFact[] = [
  {
    code: "GT",
    name: "Guatemala",
    capital: "Guatemala City",
    emoji: "🌋",
    fact: "Guatemala is home to ancient Mayan ruins and tall, sleepy volcanoes.",
  },
  {
    code: "BZ",
    name: "Belize",
    capital: "Belmopan",
    emoji: "🐠",
    fact: "Belize is covered in jungle and has the world's second-largest barrier reef.",
  },
  {
    code: "HN",
    name: "Honduras",
    capital: "Tegucigalpa",
    emoji: "🏛️",
    fact: "Honduras has rainforests and the ruins of Copán, a famous Mayan city.",
  },
  {
    code: "SV",
    name: "El Salvador",
    capital: "San Salvador",
    emoji: "🗻",
    fact: "El Salvador is nicknamed the 'Land of Volcanoes' for its many mountains.",
  },
  {
    code: "NI",
    name: "Nicaragua",
    capital: "Managua",
    emoji: "🦜",
    fact: "Nicaragua has beautiful lakes and is home to colorful parrots and monkeys.",
  },
  {
    code: "CR",
    name: "Costa Rica",
    capital: "San José",
    emoji: "🦥",
    fact: "Costa Rica is home to rainforests, sloths, and hundreds of kinds of birds.",
  },
  {
    code: "PA",
    name: "Panama",
    capital: "Panama City",
    emoji: "🚢",
    fact: "Panama has a famous canal that lets ships travel between two oceans.",
  },
];

// Guatemala's neck (Belize) and El Salvador's sliver are far too small to be
// honest 88px touch targets, so they get side buttons instead.
export const SMALL_COUNTRIES = ["SV", "BZ"];
