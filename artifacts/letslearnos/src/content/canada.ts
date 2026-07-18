export type ProvinceRegion = "Eastern" | "Western" | "Northern";

export interface ProvinceFact {
  code: string;
  name: string;
  capital: string;
  region: ProvinceRegion;
  emoji: string; // decorative, shown on the info card
  fact: string;
}

export const provinceRegions: ProvinceRegion[] = ["Eastern", "Western", "Northern"];

export const canadianProvinces: ProvinceFact[] = [
  // Eastern
  {
    code: "ON",
    name: "Ontario",
    capital: "Toronto",
    region: "Eastern",
    emoji: "🌊",
    fact: "Niagara Falls is on the border between Ontario and the United States.",
  },
  {
    code: "QC",
    name: "Quebec",
    capital: "Quebec City",
    region: "Eastern",
    emoji: "🏰",
    fact: "Quebec has lots of French-speaking people and beautiful old cities.",
  },
  {
    code: "NB",
    name: "New Brunswick",
    capital: "Fredericton",
    region: "Eastern",
    emoji: "🏖️",
    fact: "New Brunswick is known for its warm hospitality and beautiful beaches.",
  },
  {
    code: "NS",
    name: "Nova Scotia",
    capital: "Halifax",
    region: "Eastern",
    emoji: "⚓",
    fact: "Nova Scotia is surrounded by the Atlantic Ocean and has many lighthouses.",
  },
  {
    code: "PE",
    name: "Prince Edward Island",
    capital: "Charlottetown",
    region: "Eastern",
    emoji: "🥔",
    fact: "PEI is famous for red soil, potatoes, and the story of Anne of Green Gables.",
  },
  {
    code: "NL",
    name: "Newfoundland and Labrador",
    capital: "St. John's",
    region: "Eastern",
    emoji: "🐧",
    fact: "Newfoundland has puffins and is where Canada's easternmost point is.",
  },
  // Western
  {
    code: "MB",
    name: "Manitoba",
    capital: "Winnipeg",
    region: "Western",
    emoji: "🐳",
    fact: "Manitoba is home to polar bears and thousands of friendly beluga whales.",
  },
  {
    code: "SK",
    name: "Saskatchewan",
    capital: "Regina",
    region: "Western",
    emoji: "💧",
    fact: "Saskatchewan has more lakes than there are people in the whole province!",
  },
  {
    code: "AB",
    name: "Alberta",
    capital: "Edmonton",
    region: "Western",
    emoji: "🏔️",
    fact: "Alberta is home to the Canadian Rockies and Banff National Park.",
  },
  {
    code: "BC",
    name: "British Columbia",
    capital: "Victoria",
    region: "Western",
    emoji: "🌲",
    fact: "British Columbia has mild weather and is full of forests and mountains.",
  },
  // Northern
  {
    code: "YT",
    name: "Yukon",
    capital: "Whitehorse",
    region: "Northern",
    emoji: "🌌",
    fact: "Yukon is where you can see the Northern Lights dance in the sky.",
  },
  {
    code: "NT",
    name: "Northwest Territories",
    capital: "Yellowknife",
    region: "Northern",
    emoji: "❄️",
    fact: "The Northwest Territories has Great Slave Lake, one of the deepest lakes on Earth.",
  },
  {
    code: "NU",
    name: "Nunavut",
    capital: "Iqaluit",
    region: "Northern",
    emoji: "🧊",
    fact: "Nunavut means 'our land' in Inuktitut and is mostly covered in ice and snow.",
  },
];

// The tiny Maritime provinces get big side buttons — their map shapes are far
// too small to be honest 88px touch targets.
export const SMALL_PROVINCES = ["PE", "NS", "NB"];
