// ---------------------------------------------------------------------------
// Rocket Launch content — /rocket (ADR-019)
//
// Two phases on one page: LEARN (tap a rocket part on the launchpad diorama
// to highlight it, zoom the camera in, and hear a kid-level 2-sentence
// explanation) and LAUNCH (spoken countdown -> ignition -> liftoff ->
// starfield orbit -> celebration). All narration lives here so
// src/pages/rocket.tsx and src/components/RocketScene.tsx stay thin
// consumers (same split as content/science.ts / content/space.ts).
//
// First-pass copy drafted by the local model (ADR-013) at
// Static educational copy; no runtime generation.
// (courier NOTES.md graded it A-/A across accuracy, tone, and format — no
// rewrites required). Edited here as the reviewer pass:
//   - Nose Cone's 2nd sentence duplicated the Capsule explanation almost
//     verbatim ("the capsule where astronauts ride safely" / "This is where
//     astronauts... ride"); rewritten so each part teaches something the
//     others don't (nose cone -> aerodynamics, capsule -> what's inside).
//   - Escape Tower's draft line ("If needed, it pulls the capsule away
//     quickly to stay safe") reads as mid-mishap framing; reworded to a
//     calm, positive "ready just in case" framing per the project's
//     positive-only-feedback rule (no failure/danger framing for the 3yo
//     profile).
//   - Added the explicit "launching is always available, exploring parts is
//     encouraged but never required" line to the intro (ADR-019's own
//     wording) since the draft didn't yet know the page would gate nothing.
//   - Added the phase-transition milestone lines (ignition/liftoff/sky
//     darkening/reaching space/orbit) as individually addressable fields
//     so src/components/RocketScene.tsx's one-shot physics events can each
//     narrate exactly once (the draft only had one combined orbit line).
// ---------------------------------------------------------------------------

export type RocketPartId =
  | "nose-cone"
  | "capsule"
  | "fins"
  | "fuel-tank"
  | "engines"
  | "escape-tower";

export interface RocketPart {
  id: RocketPartId;
  label: string;
  /** Exactly two sentences — spoken + shown on the fact card when tapped or
   *  picked from the part-picker dock. */
  explanation: string;
}

export const ROCKET_PARTS: RocketPart[] = [
  {
    id: "escape-tower",
    label: "Escape Tower",
    explanation:
      "The escape tower is a tiny helper rocket perched at the very top, ready just in case. It can quickly pull the capsule to safety, keeping astronauts protected every step of the way.",
  },
  {
    id: "nose-cone",
    label: "Nose Cone",
    explanation:
      "The nose cone is the pointy top of the rocket, shaped to slice smoothly through the air. Its clever shape helps the rocket zoom upward without the wind slowing it down.",
  },
  {
    id: "capsule",
    label: "Capsule",
    explanation:
      "The capsule is where astronauts or important cargo ride, tucked safely inside the rocket. It carries everything they need to stay safe all the way up to space.",
  },
  {
    id: "fins",
    label: "Fins",
    explanation:
      "Fins are like arrow feathers that help the rocket fly straight instead of wobbling. They keep everything steady all the way up into the sky.",
  },
  {
    id: "fuel-tank",
    label: "Fuel Tank",
    explanation:
      "The fuel tank holds the rocket's special fuel, like a big tank of rocket food. When the engines burn that fuel, it makes the powerful push the rocket needs to lift off.",
  },
  {
    id: "engines",
    label: "Engines",
    explanation:
      "The engines burn the fuel and shoot hot, fiery gas out the bottom. That blast pushes the whole rocket up into the sky — the stronger the blast, the faster it flies!",
  },
];

export function getRocketPart(id: RocketPartId): RocketPart | undefined {
  return ROCKET_PARTS.find((part) => part.id === id);
}

// Top-to-bottom order (matches the physical rocket and reads nicely as a
// picker dock row: escape tower first, engines last).
export const ROCKET_PART_ORDER: RocketPartId[] = ROCKET_PARTS.map((part) => part.id);

/** Exact string spoken (and shown) for a tapped/picked part — a single
 *  compose function used by BOTH the page and warm-tts.ts so the two stay
 *  byte-identical (same discipline as space.tsx's speakBody). */
export function speakablePart(part: RocketPart): string {
  return `${part.label}. ${part.explanation}`;
}

// ---------------------------------------------------------------------------
// UI labels
// ---------------------------------------------------------------------------
export const ROCKET_LABELS = {
  kicker: "Space",
  learnPageHeading: "Rocket Launch",
  launchButton: "Launch!",
  launchButtonLocked: "Launching…",
  flyAgainButton: "Fly Again!",
  backButton: "Back",
  sayAgainLabel: "Say It Again",
};

// ---------------------------------------------------------------------------
// Narration lines — every field here is a full, standalone spoken string.
// ---------------------------------------------------------------------------
export const ROCKET_LINES = {
  /** Spoken once on mount, before anything is tapped. Explicitly tells the
   *  child that exploring parts is optional — launching is always available
   *  (ADR-019: "a child must never get stuck"). */
  introWelcome: "You're about to do something awesome — here comes a rocket!",
  introHint:
    "Tap a part of the rocket to learn what it does, or press the big Launch button whenever you're ready to blast off.",

  /** Spoken the instant the LAUNCH button is pressed, before the numbers
   *  start — frames what's about to happen. */
  countdownFraming: "Let's count down together!",

  /** Spoken right as the engines light, at the top of the ignition stage. */
  ignitionLine: "Engines are going BOOM! Fire and smoke shoot down below!",
  /** Spoken the instant the rocket's thrust overcomes gravity and it first
   *  leaves the pad. */
  liftoffLine: "Up, up, up — we're leaving the ground!",
  /** Spoken once the sky has visibly started fading toward night. */
  skyDarkeningLine: "Look! The sky is turning dark, and stars are coming out!",
  /** Spoken once the starfield is mostly faded in — the rocket has left the
   *  thick part of the atmosphere. */
  reachingSpaceLine: "We made it to space! Look how far up we flew!",

  /** Spoken together, in order, once the rocket settles into its gentle
   *  orbit drift — the celebration beat. */
  celebrationLine: "We did it! We flew our rocket all the way to space!",
  speedFactLine:
    "Rockets have to go super, super fast to escape Earth's gravity — and ours just did it!",

  /** Spoken when "Fly Again" is pressed, right before the scene resets. */
  flyAgainLine: "Let's fly again!",

  /** Narrated fallback when WebGL can't start (a toddler can't read why the
   *  3D scene went away) — precedent: geography.tsx's globe fallback line,
   *  warm-tts.ts lines 256-262. */
  webglFallbackLine:
    "The rocket needs 3D graphics to show the launchpad. You can still tap the part buttons below to learn about the rocket, and press Launch to blast off.",
};

// ---------------------------------------------------------------------------
// Countdown — each entry is the EXACT spoken word (not a digit), so
// warm-tts.ts can byte-match every phrase the page passes to speakText.
// 3yo gets a short 5-1 count; 5yo gets the full 10-1 count (ADR-019).
// ---------------------------------------------------------------------------
export const COUNTDOWN_NUMBERS = {
  threeYo: ["Five", "Four", "Three", "Two", "One"] as string[],
  fiveYo: [
    "Ten",
    "Nine",
    "Eight",
    "Seven",
    "Six",
    "Five",
    "Four",
    "Three",
    "Two",
    "One",
  ] as string[],
};

export const BLAST_OFF_WORD = "Blast off!";

export function getCountdownWords(is3yo: boolean): string[] {
  return is3yo ? COUNTDOWN_NUMBERS.threeYo : COUNTDOWN_NUMBERS.fiveYo;
}

/** Every spoken line in the module, flattened for prefetch-on-mount and for
 *  warm-tts.ts's buildRocketPhrases() to enumerate trivially. */
export function allRocketSpokenLines(): string[] {
  return [
    ROCKET_LINES.introWelcome,
    ROCKET_LINES.introHint,
    ROCKET_LINES.countdownFraming,
    ROCKET_LINES.ignitionLine,
    ROCKET_LINES.liftoffLine,
    ROCKET_LINES.skyDarkeningLine,
    ROCKET_LINES.reachingSpaceLine,
    ROCKET_LINES.celebrationLine,
    ROCKET_LINES.speedFactLine,
    ROCKET_LINES.flyAgainLine,
    ROCKET_LINES.webglFallbackLine,
    ...ROCKET_PARTS.map((part) => speakablePart(part)),
    ...COUNTDOWN_NUMBERS.threeYo,
    ...COUNTDOWN_NUMBERS.fiveYo,
    BLAST_OFF_WORD,
  ];
}
