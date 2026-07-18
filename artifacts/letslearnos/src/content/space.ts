// ---------------------------------------------------------------------------
// Solar system content — static, real astronomy, kid-friendly framing.
//
// `radius` / `orbitRadius` are DISPLAY-scaled 3D world units for the
// three.js scene in src/pages/space.tsx and src/pages/space-dwarfs.tsx — not
// real-world scale (real distances/sizes would make Mercury invisible and
// Neptune's year take an hour). Inner bodies always orbit faster than outer
// ones, matching the real ordering, just compressed for a watchable, living
// model (see ADR-014).
// ---------------------------------------------------------------------------

export type CelestialKind = "star" | "planet" | "dwarf-planet";

export interface CelestialBody {
  id: string;
  name: string;
  kind: CelestialKind;
  /** [highlight, mid, shadow] — feeds the procedural canvas textures. */
  colors: [string, string, string];
  /** Display radius in 3D world units. */
  radius: number;
  /** Display orbit distance in 3D world units (0 for the Sun). */
  orbitRadius: number;
  /** Seconds for one full lap around the Sun (display-scaled, not real). */
  orbitPeriod: number;
  /** Seconds for one full spin on its axis. Negative = spins backwards. */
  spinPeriod: number;
  /** Degrees the spin axis leans from "straight up". */
  axialTilt: number;
  /** Saturn (and, in real life, Haumea!) have rings. */
  hasRing?: boolean;
  /** Haumea is squashed into a stretched, football-like shape. */
  squashed?: boolean;
  facts: string[];
}

export const SUN: CelestialBody = {
  id: "sun",
  name: "Sun",
  kind: "star",
  colors: ["#fff2b0", "#ffb703", "#c1440e"],
  radius: 1.5,
  orbitRadius: 0,
  orbitPeriod: 0,
  spinPeriod: 40,
  axialTilt: 0,
  facts: [
    "The Sun is a giant ball of hot glowing gas — it's a star!",
    "It's so big that over one million Earths could fit inside it.",
    "The Sun gives us light and heat — without it, life on Earth couldn't exist.",
  ],
};

export const PLANET_LIST: CelestialBody[] = [
  {
    id: "mercury",
    name: "Mercury",
    kind: "planet",
    colors: ["#c9b7a4", "#8c7853", "#4a3f30"],
    radius: 0.16,
    orbitRadius: 3.0,
    orbitPeriod: 6,
    spinPeriod: 8,
    axialTilt: 0,
    facts: [
      "Mercury is the closest planet to the Sun.",
      "It's the smallest planet in our solar system — just a little bigger than Earth's Moon!",
      "A year on Mercury is only 88 Earth days long — it zips around the Sun fast!",
    ],
  },
  {
    id: "venus",
    name: "Venus",
    kind: "planet",
    colors: ["#f3dfa8", "#d9a441", "#a5680f"],
    radius: 0.26,
    orbitRadius: 4.0,
    orbitPeriod: 10,
    spinPeriod: -26,
    axialTilt: 3,
    facts: [
      "Venus is the hottest planet — even hotter than Mercury, because of its thick clouds!",
      "It spins backwards compared to Earth — on Venus, the Sun would rise in the west!",
      "Venus is often called Earth's 'sister planet' because they're almost the same size.",
    ],
  },
  {
    id: "earth",
    name: "Earth",
    kind: "planet",
    colors: ["#8fe3a1", "#2f8fd1", "#154273"],
    radius: 0.28,
    orbitRadius: 5.2,
    orbitPeriod: 14,
    spinPeriod: 3,
    axialTilt: 23.4,
    facts: [
      "Earth is the only planet we know of that has life — and lots of it!",
      "It's the only planet with liquid water on the surface — oceans, lakes, and rivers.",
      "Earth has one moon — our friendly Moon that shines at night!",
    ],
  },
  {
    id: "mars",
    name: "Mars",
    kind: "planet",
    colors: ["#e8875f", "#b3401f", "#6e2510"],
    radius: 0.22,
    orbitRadius: 6.4,
    orbitPeriod: 18,
    spinPeriod: 3.2,
    axialTilt: 25,
    facts: [
      "Mars is known as the Red Planet because of its rusty, reddish dust.",
      "It has the tallest volcano in the solar system — Olympus Mons — taller than Mount Everest!",
      "Scientists are sending robots to explore Mars, and maybe one day people will visit too.",
    ],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    kind: "planet",
    colors: ["#e9d3ad", "#c98a4b", "#8a4a22"],
    radius: 0.62,
    orbitRadius: 8.6,
    orbitPeriod: 26,
    spinPeriod: 1.4,
    axialTilt: 3,
    facts: [
      "Jupiter is the biggest planet — over 1,300 Earths could fit inside it!",
      "It has a giant storm called the Great Red Spot that has been swirling for hundreds of years.",
      "Jupiter has more than 90 moons — more than any other planet!",
    ],
  },
  {
    id: "saturn",
    name: "Saturn",
    kind: "planet",
    colors: ["#f2e3b0", "#d8b978", "#a3823f"],
    radius: 0.54,
    orbitRadius: 10.8,
    orbitPeriod: 34,
    spinPeriod: 1.6,
    axialTilt: 27,
    hasRing: true,
    facts: [
      "Saturn is famous for its beautiful rings, made of countless chunks of ice and rock.",
      "It's a gas giant — Saturn is so light that it would float if you found a bathtub big enough!",
      "Saturn has more than 140 moons, including Titan, which has lakes of liquid methane!",
    ],
  },
  {
    id: "uranus",
    name: "Uranus",
    kind: "planet",
    colors: ["#c9f3ec", "#7fd8d8", "#3f9aa8"],
    radius: 0.4,
    orbitRadius: 12.8,
    orbitPeriod: 42,
    spinPeriod: 2.2,
    axialTilt: 98,
    facts: [
      "Uranus spins on its side — it rolls around the Sun like a ball instead of spinning upright!",
      "It's an ice giant, made mostly of water, ammonia, and methane ices.",
      "Uranus is so far away that sunlight takes over two hours to reach it!",
    ],
  },
  {
    id: "neptune",
    name: "Neptune",
    kind: "planet",
    colors: ["#7fa8f5", "#2f57c9", "#152e73"],
    radius: 0.38,
    orbitRadius: 14.8,
    orbitPeriod: 50,
    spinPeriod: 2.4,
    axialTilt: 28,
    facts: [
      "Neptune is the windiest planet — storms blow faster than 1,200 miles per hour!",
      "It's the farthest planet from the Sun — a freezing, deep-blue world.",
      "Neptune was the first planet found by math, before anyone ever saw it through a telescope!",
    ],
  },
];

export const DWARF_LIST: CelestialBody[] = [
  {
    id: "ceres",
    name: "Ceres",
    kind: "dwarf-planet",
    colors: ["#e4e2df", "#b3ada4", "#6f6a63"],
    radius: 0.14,
    orbitRadius: 3.2,
    orbitPeriod: 12,
    spinPeriod: 4,
    axialTilt: 4,
    facts: [
      "Ceres is the only dwarf planet in the inner solar system — it lives in the asteroid belt.",
      "It's round like a planet, but small — about a quarter the size of Earth's Moon.",
      "Ceres might have water ice, and even a salty ocean, hiding under its surface!",
    ],
  },
  {
    id: "pluto",
    name: "Pluto",
    kind: "dwarf-planet",
    colors: ["#e8cba3", "#b98650", "#6e4a26"],
    radius: 0.13,
    orbitRadius: 5.6,
    orbitPeriod: 20,
    spinPeriod: 30,
    axialTilt: 120,
    facts: [
      "Pluto is small and icy, out in a region beyond Neptune called the Kuiper Belt.",
      "It has a giant heart-shaped glacier that scientists nicknamed 'Tombaugh Regio'.",
      "Pluto has five moons — Charon is so big that Pluto and Charon circle each other like a pair!",
    ],
  },
  {
    id: "eris",
    name: "Eris",
    kind: "dwarf-planet",
    colors: ["#f5f5f5", "#c9c9cf", "#83838d"],
    radius: 0.13,
    orbitRadius: 7.6,
    orbitPeriod: 26,
    spinPeriod: 12,
    axialTilt: 44,
    facts: [
      "Eris is the heaviest dwarf planet — it even weighs more than Pluto!",
      "It's so far away that sunlight takes days to reach it.",
      "Discovering Eris helped scientists realize Pluto wasn't alone — that led to the 'dwarf planet' category!",
    ],
  },
  {
    id: "haumea",
    name: "Haumea",
    kind: "dwarf-planet",
    colors: ["#ffffff", "#dfe6ee", "#9aa6b5"],
    radius: 0.16,
    orbitRadius: 9.6,
    orbitPeriod: 30,
    spinPeriod: 1.6,
    axialTilt: 8,
    hasRing: true,
    squashed: true,
    facts: [
      "Haumea spins so fast — once every 4 hours — that it's stretched into a squashed, football-like shape!",
      "It has a ring around it, and two small moons named Hi'iaka and Namaka.",
      "It's covered in bright ice and named after a Hawaiian goddess of childbirth.",
    ],
  },
  {
    id: "makemake",
    name: "Makemake",
    kind: "dwarf-planet",
    colors: ["#e5a06b", "#b3612f", "#6e3a1a"],
    radius: 0.12,
    orbitRadius: 11.4,
    orbitPeriod: 34,
    spinPeriod: 11,
    axialTilt: 29,
    facts: [
      "Makemake is one of the reddest objects in the solar system — like a rusty apple!",
      "It has one small, dark moon that scientists nicknamed 'MK 2', discovered in 2016!",
      "It was named after a creator god from Rapa Nui (Easter Island) mythology.",
    ],
  },
];

export const CELESTIAL_BODIES: CelestialBody[] = [SUN, ...PLANET_LIST, ...DWARF_LIST];

export const PLANETS: CelestialBody[] = PLANET_LIST;
export const DWARF_PLANETS: CelestialBody[] = DWARF_LIST;

export function getCelestialBody(id: string): CelestialBody | undefined {
  return CELESTIAL_BODIES.find((body) => body.id === id);
}
