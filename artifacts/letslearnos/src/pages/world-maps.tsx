import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap } from "@/lib/sound";

interface MapChoice {
  id: string;
  label: string;
  sublabel: string;
  pokemonId: number;
  color: string;
  path: string;
}

const MAPS: MapChoice[] = [
  {
    id: "usa",
    label: "United States",
    sublabel: "50 states, capitals, and fun facts",
    pokemonId: 149,
    color: "bg-sky-500",
    path: "/usa",
  },
  {
    id: "canada",
    label: "Canada",
    sublabel: "Provinces and territories up north",
    pokemonId: 461,
    color: "bg-red-500",
    path: "/canada",
  },
  {
    id: "central-america",
    label: "Central America",
    sublabel: "Seven countries between two oceans",
    pokemonId: 254,
    color: "bg-teal-500",
    path: "/central-america",
  },
  {
    id: "south-america",
    label: "South America",
    sublabel: "Rainforests, mountains, and more",
    pokemonId: 388,
    color: "bg-emerald-500",
    path: "/south-america",
  },
];

export default function WorldMapsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/home")}
          className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow"
          aria-label="Back"
        >
          <ArrowLeft size={28} />
        </button>
        <div>
          <p className="text-lg font-black text-blue-500">Geography</p>
          <h1 className="text-3xl font-black text-slate-900">World Maps</h1>
        </div>
      </div>

      <p className="mb-4 text-lg font-bold text-slate-600">
        Pick a map to explore. Tap any state, province, or country to hear
        its name!
      </p>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto pb-6 sm:grid-cols-2">
        {MAPS.map((map, i) => (
          <motion.button
            key={map.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playTap();
              navigate(map.path);
            }}
            className={`${map.color} flex min-h-[120px] items-center gap-5 rounded-3xl p-5 text-left text-white shadow-lg`}
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <img
                src={ARTWORK(map.pokemonId)}
                onError={onSpriteError}
                alt=""
                className="h-16 w-16 object-contain drop-shadow"
              />
            </div>
            <div>
              <p className="text-3xl font-black">{map.label}</p>
              <p className="text-lg font-bold text-white/85 leading-snug">
                {map.sublabel}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
