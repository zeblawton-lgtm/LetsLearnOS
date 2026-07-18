import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useSession } from "@/context/SessionContext";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap } from "@/lib/sound";
import { Users } from "lucide-react";

const SPRITE = ARTWORK;

// Big "type card" subjects — each learning module is fronted by a starter
// Pokémon and styled like its type (kid-recognizable, pre-reader friendly).
const subjects = [
  {
    id: "math",
    label: "Math",
    typePill: "🔥 Fire Type",
    pokemonId: 4,
    path: "/math",
    gradient: "linear-gradient(160deg,#ff7c45,#e85d2a)",
    shadow: "0 8px 0 #c44a1d",
  },
  {
    id: "spanish",
    label: "Spanish",
    typePill: "💧 Water Type",
    pokemonId: 7,
    path: "/spanish",
    gradient: "linear-gradient(160deg,#4aa8ff,#2b86e0)",
    shadow: "0 8px 0 #1e6bbd",
  },
  {
    id: "geography",
    label: "World",
    typePill: "🌿 Grass Type",
    pokemonId: 1,
    path: "/geography",
    gradient: "linear-gradient(160deg,#52c46a,#36a350)",
    shadow: "0 8px 0 #27843e",
  },
];

// Each fun tile gets its own bundled Pokémon mascot and its own vibrant
// gradient — same chunky "pressable" design language as the subject cards
// above (light-to-dark 160deg gradient + hard offset shadow), so the grid
// reads like a rainbow of activities instead of a flat white grid. Colors
// are chosen so no two tiles that are adjacent (incl. diagonally) in the
// 5-column grid share a hue family. Every tile also gets a unique mascot —
// Puzzle/Shadow/Stickers/Piano originally all shared Pikachu (25); they're
// now Eevee/Gengar/Mimikyu/Wigglytuff so no sprite id repeats across the
// grid. `darkText` flags the (rare) pale gradients — bright yellows read too
// light for white text even at the same HSL lightness as, say, an orange
// tile — so those get dark brown text instead. `colStart` positions the
// last row's centered quartet (19 tiles = 5+5+5+4, see the row-4 comment
// below for how the leftover column is centered).
const fun: {
  id: string;
  label: string;
  pokemonId: number;
  path: string;
  gradient: string;
  shadow: string;
  darkText?: boolean;
  colStart?: string;
}[] = [
  // Row 1
  {
    id: "coloring",
    label: "Coloring",
    pokemonId: 39,
    path: "/coloring",
    gradient: "linear-gradient(160deg,#ff8fc4,#ee5fa4)",
    shadow: "0 6px 0 #c74484",
  },
  {
    id: "tracing",
    label: "Tracing",
    pokemonId: 196,
    path: "/tracing",
    gradient: "linear-gradient(160deg,#b68cff,#9260ea)",
    shadow: "0 6px 0 #7448c8",
  },
  {
    id: "dots",
    label: "Dots",
    pokemonId: 26,
    path: "/dots",
    gradient: "linear-gradient(160deg,#ffb054,#f58c1e)",
    shadow: "0 6px 0 #cf7013",
  },
  {
    id: "match",
    label: "Memory",
    pokemonId: 150,
    path: "/match",
    gradient: "linear-gradient(160deg,#9aa5ff,#6b74ef)",
    shadow: "0 6px 0 #545cc9",
  },
  {
    id: "seek",
    label: "Hide & Seek",
    pokemonId: 132,
    path: "/seek",
    gradient: "linear-gradient(160deg,#4ade80,#16a34a)",
    shadow: "0 6px 0 #166534",
  },

  // Row 2 — new creative-corner activities
  {
    id: "puzzle",
    label: "Puzzle",
    pokemonId: 133, // Eevee — many forms, many ways the pieces fit together
    path: "/puzzle",
    gradient: "linear-gradient(160deg,#60a5fa,#2563eb)",
    shadow: "0 6px 0 #1e40af",
  },
  {
    id: "shadow",
    label: "Shadows",
    pokemonId: 94, // Gengar — "a playful ghost that likes to hide in shadows"
    path: "/shadow",
    gradient: "linear-gradient(160deg,#fde047,#eab308)",
    shadow: "0 6px 0 #a16207",
    darkText: true,
  },
  {
    id: "stickers",
    label: "Sticker Book",
    pokemonId: 778, // Mimikyu — crafty costume Pokémon, sticker-book vibes
    path: "/stickers",
    gradient: "linear-gradient(160deg,#fb7185,#e11d48)",
    shadow: "0 6px 0 #9f1239",
  },
  {
    id: "piano",
    label: "Piano",
    pokemonId: 40, // Wigglytuff — Jigglypuff's singing evolution
    path: "/piano",
    gradient: "linear-gradient(160deg,#67e8f9,#06b6d4)",
    shadow: "0 6px 0 #0e7490",
  },
  {
    id: "stories",
    label: "Story Time",
    pokemonId: 1,
    path: "/stories",
    gradient: "linear-gradient(160deg,#fbbf24,#d97706)",
    shadow: "0 6px 0 #92400e",
  },

  // Row 3 — explore
  {
    id: "usa",
    label: "USA",
    pokemonId: 145,
    path: "/usa",
    gradient: "linear-gradient(160deg,#ff7d72,#e74c40)",
    shadow: "0 6px 0 #c0362b",
  },
  {
    id: "world-maps",
    label: "Maps",
    pokemonId: 149,
    path: "/world-maps",
    gradient: "linear-gradient(160deg,#42d4b4,#17b191)",
    shadow: "0 6px 0 #0e8f75",
  },
  {
    id: "science",
    label: "Science",
    pokemonId: 113,
    path: "/science",
    gradient: "linear-gradient(160deg,#8fd94f,#66bd2b)",
    shadow: "0 6px 0 #4f9a1f",
  },
  {
    id: "space",
    label: "Space",
    pokemonId: 35,
    path: "/space",
    gradient: "linear-gradient(160deg,#7668e8,#5240c9)",
    shadow: "0 6px 0 #3f30a3",
  },
  {
    id: "pokedex",
    label: "Pokédex",
    pokemonId: 151,
    path: "/pokedex",
    gradient: "linear-gradient(160deg,#f77ae0,#d94fc2)",
    shadow: "0 6px 0 #b23a9e",
  },

  // Row 4 — Hidden Search (ADR-021) brings the count to 20 = a full 4x5
  // grid, so the old 19-tile centered-gap workaround (colStart on every
  // row-4 tile) is gone. Hue adjacency still holds: search's royal blue in
  // column 3 sits between progress's yellow (c2) and maze's orange (c4),
  // under science's green (c3), diagonal to world-maps teal (c2) and
  // space's purple (c4) — no shared hue family with any of them. Maze's
  // orange stays clear of usa's coral-red (c1) by living in column 4, and
  // rocket keeps its turquoise for the same reason (see git history).
  {
    id: "regions",
    label: "Regions",
    pokemonId: 131,
    path: "/regions",
    gradient: "linear-gradient(160deg,#4fc6f0,#22a3d8)",
    shadow: "0 6px 0 #1682b0",
  },
  {
    id: "progress",
    label: "Progress",
    pokemonId: 175,
    path: "/progress",
    gradient: "linear-gradient(160deg,#ffe27a,#ffc83d)",
    shadow: "0 6px 0 #d99e16",
    darkText: true,
  },
  {
    id: "search",
    label: "Hidden Search",
    pokemonId: 54, // Psyduck — the perpetually puzzled searcher
    path: "/search",
    gradient: "linear-gradient(160deg,#5b8bff,#3557d4)",
    shadow: "0 6px 0 #2842a8",
  },
  {
    id: "maze",
    label: "Mazes",
    pokemonId: 58, // Growlithe — a loyal guide sniffing out the path
    path: "/maze",
    gradient: "linear-gradient(160deg,#ff9472,#e2492a)",
    shadow: "0 6px 0 #ab3013",
  },
  {
    id: "rocket",
    label: "Rocket Launch",
    pokemonId: 6, // Charizard — fiery flyer, launch-day energy; tile itself
    // goes turquoise (not flame orange/red) so it doesn't share a hue
    // family with its column-4 neighbor Mazes or with usa/space above.
    path: "/rocket",
    gradient: "linear-gradient(160deg,#2dd4bf,#0d9488)",
    shadow: "0 6px 0 #0f766e",
  },
];

// A soft cartoon cloud drifting across the sky. Built from plain divs so it
// needs no assets; starts off-screen left and loops.
function Cloud({
  top,
  duration,
  delay,
  scale,
}: {
  top: string;
  duration: number;
  delay: number;
  scale: number;
}) {
  return (
    <motion.div
      aria-hidden
      className="absolute pointer-events-none opacity-80"
      style={{ top, left: 0, scale }}
      initial={{ x: "-180px" }}
      animate={{ x: "105vw" }}
      transition={{ repeat: Infinity, duration, delay, ease: "linear" }}
    >
      <div className="relative">
        <div className="w-36 h-11 bg-white rounded-full" />
        <div className="absolute w-14 h-14 bg-white rounded-full -top-7 left-6" />
        <div className="absolute w-11 h-11 bg-white rounded-full -top-4 left-16" />
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { profile, endSession } = useSession();
  const [, navigate] = useLocation();

  // Ending the session drops profile to null, so the app returns to the
  // profile picker — that is where learners switch who is playing.
  const handleSwitchPlayer = () => {
    playTap();
    void endSession();
  };

  const go = (path: string) => {
    playTap();
    navigate(path);
  };

  return (
    // No fixed height / overflow-hidden here: with 19 fun tiles the grid can
    // run slightly taller than 1080px on some content, and we'd rather the
    // page scroll smoothly (the sky backdrop below is position:fixed so it
    // still covers the viewport while scrolling) than clip the last row.
    <div className="relative flex flex-col px-6 py-3">
      {/* Sky backdrop + drifting clouds (fixed so it sits under the TopBar too) */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg,#8ed4ff 0%,#c8ecff 55%,#d8f5cf 100%)",
        }}
      />
      <Cloud top="9%" duration={65} delay={0} scale={1} />
      <Cloud top="20%" duration={90} delay={12} scale={0.7} />

      {/* Greeting: the child's own avatar bounces next to a speech bubble */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-5 mt-1 mb-2"
      >
        <motion.img
          src={SPRITE(profile?.avatarPokemonId ?? 25)}
          onError={onSpriteError}
          alt=""
          className="w-36 h-36 object-contain drop-shadow-xl"
          animate={{ y: [0, -12, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          draggable={false}
        />
        <div
          className="relative bg-white rounded-3xl px-7 py-4"
          style={{ boxShadow: "0 5px 0 rgba(0,0,0,0.08)" }}
        >
          <div
            aria-hidden
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rotate-45"
          />
          <h1 className="text-5xl font-black text-gray-800 leading-tight">
            Hi, {profile?.name}!
          </h1>
          <p className="text-xl font-bold text-gray-500">
            Tap a friend to start learning
          </p>
        </div>

        <button
          onClick={handleSwitchPlayer}
          className="ml-auto flex items-center gap-2 bg-white rounded-2xl px-6 min-h-[88px]"
          style={{ boxShadow: "0 5px 0 rgba(0,0,0,0.08)" }}
        >
          <Users size={28} className="text-pokemon-blue" />
          <span className="text-base font-black text-gray-700">
            Switch Player
          </span>
        </button>
      </motion.div>

      {/* Subject type cards — artwork intentionally overflows the card top */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="flex gap-10 justify-center items-stretch w-full max-w-6xl mt-6">
          {subjects.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => go(s.path)}
              className="flex-1 max-w-[430px] rounded-[36px] px-5 pb-8 text-white flex flex-col items-center gap-3"
              style={{ background: s.gradient, boxShadow: s.shadow }}
            >
              <motion.img
                src={SPRITE(s.pokemonId)}
                onError={onSpriteError}
                alt=""
                className="w-56 h-56 object-contain -mt-16"
                style={{ filter: "drop-shadow(0 6px 5px rgba(0,0,0,0.25))" }}
                whileHover={{ scale: 1.08, rotate: -3 }}
                draggable={false}
              />
              <span
                className="text-5xl font-black"
                style={{ textShadow: "0 2px 0 rgba(0,0,0,0.18)" }}
              >
                {s.label}
              </span>
              <span className="bg-white/30 rounded-full px-6 py-1.5 text-xl font-bold">
                {s.typePill}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Fun row — creative corner + explore screens, five per row across
          four rows (last row is a centered quartet, split 2-gap-2 so the
          leftover column sits dead center instead of at an edge), each in
          its own vivid gradient (same pressable look as the subject cards).
          Tile height is trimmed from the original 152px to 128px, still well
          above the 88px touch-target minimum, so all 19 tiles fit with
          minimal scroll. */}
      <div className="mt-3 grid grid-cols-5 gap-4 pb-8 w-full max-w-[1800px] mx-auto">
        {fun.map((f, i) => (
          <motion.button
            key={f.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3 + i * 0.04,
              type: "spring",
              stiffness: 220,
            }}
            whileTap={{ scale: 0.92 }}
            onClick={() => go(f.path)}
            className={`h-[128px] rounded-3xl flex flex-col items-center justify-center gap-1 text-xl font-black ${
              f.darkText ? "text-amber-900" : "text-white"
            } ${f.colStart ?? ""}`}
            style={{
              background: f.gradient,
              boxShadow: f.shadow,
              textShadow: f.darkText ? undefined : "0 2px 0 rgba(0,0,0,0.18)",
            }}
          >
            <img
              src={SPRITE(f.pokemonId)}
              onError={onSpriteError}
              alt=""
              className="h-[84px] w-[84px] object-contain"
              style={{ filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.18))" }}
              draggable={false}
            />
            {f.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
