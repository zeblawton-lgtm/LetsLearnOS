// USA explorer facts — one short, spoken line per state, kept simple enough
// for ages 3–5 to follow when narrated aloud. State names/geometry live in
// usa-map.ts; entries here are keyed by USPS code.

export interface StateFact {
  emoji: string; // decorative, shown on the info card
  capital: string;
  fact: string; // one spoken sentence
}

export const STATE_FACTS: Record<string, StateFact> = {
  AL: { emoji: "🚀", capital: "Montgomery", fact: "Alabama is where the rockets that flew to the Moon were built!" },
  AK: { emoji: "🐻‍❄️", capital: "Juneau", fact: "Alaska is the biggest state, with glaciers, moose, and polar bears!" },
  AZ: { emoji: "🏜️", capital: "Phoenix", fact: "Arizona has the Grand Canyon, a giant colorful canyon!" },
  AR: { emoji: "💎", capital: "Little Rock", fact: "Arkansas has a park where you can dig for real diamonds!" },
  CA: { emoji: "🌲", capital: "Sacramento", fact: "California has redwood trees, the tallest trees in the whole world!" },
  CO: { emoji: "🏔️", capital: "Denver", fact: "Colorado has the tall, snowy Rocky Mountains!" },
  CT: { emoji: "🚁", capital: "Hartford", fact: "Connecticut is where the first helicopter was built!" },
  DE: { emoji: "1️⃣", capital: "Dover", fact: "Delaware was the very first state — number one!" },
  FL: { emoji: "🐊", capital: "Tallahassee", fact: "Florida is full of alligators, beaches, and rocket launches!" },
  GA: { emoji: "🍑", capital: "Atlanta", fact: "Georgia grows sweet, juicy peaches!" },
  HI: { emoji: "🌋", capital: "Honolulu", fact: "Hawaii is made of islands, with volcanoes and surfing!" },
  ID: { emoji: "🥔", capital: "Boise", fact: "Idaho grows the most potatoes — hello, french fries!" },
  IL: { emoji: "🏙️", capital: "Springfield", fact: "Illinois has Chicago, with some of the tallest buildings in America!" },
  IN: { emoji: "🏎️", capital: "Indianapolis", fact: "Indiana has a giant car race called the Indy Five Hundred!" },
  IA: { emoji: "🌽", capital: "Des Moines", fact: "Iowa grows more corn than any other state!" },
  KS: { emoji: "🌻", capital: "Topeka", fact: "Kansas has big open fields full of sunflowers!" },
  KY: { emoji: "🐎", capital: "Frankfort", fact: "Kentucky is famous for fast horses and horse races!" },
  LA: { emoji: "🎷", capital: "Baton Rouge", fact: "Louisiana has swamps, jazz music, and yummy gumbo!" },
  ME: { emoji: "🦞", capital: "Augusta", fact: "Maine has lighthouses, lobsters, and blueberries!" },
  MD: { emoji: "🦀", capital: "Annapolis", fact: "Maryland is famous for crabs from the Chesapeake Bay!" },
  MA: { emoji: "⛵", capital: "Boston", fact: "Massachusetts is where the Pilgrims landed on the Mayflower ship!" },
  MI: { emoji: "🧤", capital: "Lansing", fact: "Michigan looks like a mitten and touches four Great Lakes!" },
  MN: { emoji: "🛶", capital: "Saint Paul", fact: "Minnesota is the land of ten thousand lakes!" },
  MS: { emoji: "🚢", capital: "Jackson", fact: "Mississippi is named after the great big Mississippi River!" },
  MO: { emoji: "🌉", capital: "Jefferson City", fact: "Missouri has the giant, shiny Gateway Arch!" },
  MT: { emoji: "🐻", capital: "Helena", fact: "Montana is Big Sky Country, with grizzly bears in the mountains!" },
  NE: { emoji: "🐄", capital: "Lincoln", fact: "Nebraska has more cows than people!" },
  NV: { emoji: "🌵", capital: "Carson City", fact: "Nevada is a sparkly desert state with lots of bright lights!" },
  NH: { emoji: "🌄", capital: "Concord", fact: "New Hampshire has forests, mountains, and covered bridges!" },
  NJ: { emoji: "🎡", capital: "Trenton", fact: "New Jersey has fun boardwalks by the beach!" },
  NM: { emoji: "🎈", capital: "Santa Fe", fact: "New Mexico has hot air balloons floating over the desert!" },
  NY: { emoji: "🗽", capital: "Albany", fact: "New York has the Statue of Liberty!" },
  NC: { emoji: "✈️", capital: "Raleigh", fact: "North Carolina is where the very first airplane flew!" },
  ND: { emoji: "🦬", capital: "Bismarck", fact: "North Dakota has wild buffalo roaming the plains!" },
  OH: { emoji: "🧑‍🚀", capital: "Columbus", fact: "Ohio is where astronauts who walked on the Moon grew up!" },
  OK: { emoji: "🤠", capital: "Oklahoma City", fact: "Oklahoma has cowboys, rodeos, and big whirling winds!" },
  OR: { emoji: "🏞️", capital: "Salem", fact: "Oregon has Crater Lake, the deepest lake in America!" },
  PA: { emoji: "🔔", capital: "Harrisburg", fact: "Pennsylvania has the Liberty Bell and lots of chocolate!" },
  RI: { emoji: "🐔", capital: "Providence", fact: "Rhode Island is the smallest state of all!" },
  SC: { emoji: "🌴", capital: "Columbia", fact: "South Carolina has palm trees and sandy beaches!" },
  SD: { emoji: "🗿", capital: "Pierre", fact: "South Dakota has Mount Rushmore — four presidents carved into a mountain!" },
  TN: { emoji: "🎸", capital: "Nashville", fact: "Tennessee is the home of country music!" },
  TX: { emoji: "🐂", capital: "Austin", fact: "Texas is a huge state with cowboys and longhorn cattle!" },
  UT: { emoji: "🦕", capital: "Salt Lake City", fact: "Utah has red rock arches and dinosaur fossils!" },
  VT: { emoji: "🥞", capital: "Montpelier", fact: "Vermont makes sweet maple syrup for pancakes!" },
  VA: { emoji: "🎩", capital: "Richmond", fact: "Virginia is where eight presidents were born!" },
  WA: { emoji: "🍎", capital: "Olympia", fact: "Washington grows the most apples — and even has a rainforest!" },
  WV: { emoji: "🚂", capital: "Charleston", fact: "West Virginia is full of misty mountains and winding trains!" },
  WI: { emoji: "🧀", capital: "Madison", fact: "Wisconsin makes mountains and mountains of cheese!" },
  WY: { emoji: "⛲", capital: "Cheyenne", fact: "Wyoming has Yellowstone, where hot water shoots right out of the ground!" },
};

// The tiny Northeast states get big side buttons — their map shapes are far
// too small to be honest 88px touch targets.
export const SMALL_STATES = ["CT", "DE", "MA", "MD", "NH", "NJ", "RI", "VT"];
