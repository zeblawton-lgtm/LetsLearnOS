// ---------------------------------------------------------------------------
// Science 3D Lab copy — /science (ADR-017)
//
// Four hands-on stations in one 3D scene: put out a campfire with water or
// sand, pour water into a basin, blow wind to spin a windmill, and grow a
// seed into a flower. All narration lives here so src/pages/science.tsx and
// src/components/ScienceScene.tsx stay thin consumers (same split as
// content/world-globe.ts / content/space.ts).
//
// First-pass copy drafted by the local model (ADR-013) at
// tmp/drafts/science3d/science3d.ts, reviewed and edited here. What changed
// from the draft: added the required fire-safety framing (GOAL §5 / ADR-017
// — the draft had none), added per-tool science facts for the fire station
// (folded in from the previous Element Lab's water-fire/sand-fire
// explanations, which were accurate and worth keeping), added "midway"/
// "building"/"sprout"/"growing" milestone lines the 3D scene can narrate at
// specific physics moments instead of only at start/end, and tightened a few
// lines flagged in the draft's NOTES.md (e.g. the wind fact — simplified for
// a 3-year-old per the draft's own flag).
// ---------------------------------------------------------------------------

export type StationId = "fire" | "water" | "wind" | "plant";
export type FireTool = "hose" | "sand";

interface BaseCopy {
  kicker: string;
  title: string;
  /** Spoken once whenever the station becomes active. */
  intro: string;
  /** Spoken right after intro, and shown as a persistent on-screen hint. */
  hint: string;
  /** Spoken + shown when the station's goal is reached. */
  complete: string;
  /** Label for the "do it again" button after completion. */
  restartLabel: string;
}

export interface FireCopy extends BaseCopy {
  id: "fire";
  /** ALWAYS spoken immediately after `intro`, every time the station is
   *  selected — required by GOAL §5 / ADR-017, never optional. */
  safetyIntro: string;
  /** Always shown on screen while the fire station is active (not just
   *  spoken once) — see the build brief's "gap to fill" note. */
  safetyBadge: string;
  /** Spoken once when the fire crosses about halfway out. */
  midway: string;
  /** Spoken again right after `complete`, reinforcing the safety framing. */
  safetyOutro: string;
  toolLabel: Record<FireTool, string>;
  /** Science fact, chosen by which tool put the fire out. */
  fact: Record<FireTool, string>;
}

export interface WaterCopy extends BaseCopy {
  id: "water";
  midway: string;
  fact: string;
}

export interface WindCopy extends BaseCopy {
  id: "wind";
  /** Spoken once the first time the child gets the windmill spinning well. */
  building: string;
  fact: string;
}

export interface PlantCopy extends BaseCopy {
  id: "plant";
  waterToolLabel: string;
  sunButtonLabel: string;
  /** Spoken when the watered seed sprouts (stage 0 -> 1). */
  sprout: string;
  /** Spoken when the sunshine grows it taller (stage 1 -> 2). */
  growing: string;
  fact: string;
}

export type StationCopy = FireCopy | WaterCopy | WindCopy | PlantCopy;

export const LAB_INTRO =
  "Welcome to the Science Lab! Pick a station to explore water, wind, fire safety, and growing plants.";

export const SAY_AGAIN_LABEL = "Say It Again";

export const FIRE_STATION: FireCopy = {
  id: "fire",
  kicker: "Science Lab",
  title: "Fire Safety Station",
  intro: "Welcome to the Fire Safety Station!",
  safetyIntro: "Fire is for grown-ups. We never touch fire.",
  safetyBadge: "Fire is for grown-ups — we never touch fire.",
  hint: "Pick the water hose or the sand bucket, then drag on the campfire.",
  midway: "Look, the fire is getting smaller! Keep going.",
  complete: "Hooray, the fire is all the way out! You did a great job helping.",
  safetyOutro:
    "Remember, fire is always for grown-ups. You helped safely from far away!",
  toolLabel: {
    hose: "Water Hose",
    sand: "Sand Bucket",
  },
  fact: {
    hose:
      "Water helps put out fire because it cools the hot fuel below the burning temperature.",
    sand: "Sand can put out a small fire by covering it and blocking the air it needs.",
  },
  restartLabel: "Try Again",
};

export const WATER_STATION: WaterCopy = {
  id: "water",
  kicker: "Science Lab",
  title: "Water Play",
  intro: "Hello! Let's pour some water and fill up the basin.",
  hint: "Drag on the water to pour and watch it splash.",
  midway: "Splash! The basin is filling up.",
  complete: "Yay! The basin is full of water!",
  fact: "Water flows downhill and fills up empty spaces, like this basin.",
  restartLabel: "Empty It Out",
};

export const WIND_STATION: WindCopy = {
  id: "wind",
  kicker: "Science Lab",
  title: "Wind Play",
  intro: "Hi there! Let's make the windmill spin.",
  hint: "Drag your finger to blow a breeze.",
  building: "Whoosh! You're making wind — watch the windmill spin!",
  complete: "Amazing! You made the windmill spin round and round!",
  fact: "Wind is moving air. It can push things, like windmill blades and kites.",
  restartLabel: "Blow Again",
};

export const PLANT_STATION: PlantCopy = {
  id: "plant",
  kicker: "Science Lab",
  title: "Plant Grow",
  intro: "Hi friend! Let's help this seed grow.",
  hint: "Drag the watering can over the soil, then bring out the sun.",
  waterToolLabel: "Watering Can",
  sunButtonLabel: "Bring Out the Sun",
  sprout: "Splash! Look, a tiny sprout is peeking out of the soil!",
  growing: "The sunshine is helping it grow taller and taller!",
  complete: "Ta-da! A beautiful flower bloomed. Amazing work!",
  fact: "Seeds need water, sunlight, air, and soil to grow into plants.",
  restartLabel: "Plant a New Seed",
};

export const STATIONS: Record<StationId, StationCopy> = {
  fire: FIRE_STATION,
  water: WATER_STATION,
  wind: WIND_STATION,
  plant: PLANT_STATION,
};

export const STATION_ORDER: StationId[] = ["fire", "water", "wind", "plant"];
