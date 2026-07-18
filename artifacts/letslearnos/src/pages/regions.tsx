import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { playTap } from "@/lib/sound";
import { speakText } from "@/lib/tts";
import { spokenText } from "@/lib/pronounce";
import { GeoScene, type GeoSceneKind } from "@/components/GeoScene";

// "Pokémon Homes" — teaches real-world habitat/biome concepts (forests, oceans,
// mountains, caves, grasslands, icy places) using Pokémon as friendly examples.
// These are REAL places on Earth — Pokémon are only imaginative guides (GOAL §9.2:
// do not present fictional regions as real).
interface Habitat {
  name: string;
  color: string;
  scene: GeoSceneKind;
  examplePlace: string;
  climate: string;
  pokemonId: number;
  pokemonName: string;
  fact: string;
}

const HABITATS: Habitat[] = [
  { name: "Rainforest", color: "bg-green-600", scene: "rainforest", examplePlace: "Amazon Rainforest", climate: "Warm and wet", pokemonId: 1, pokemonName: "Bulbasaur", fact: "Rainforests are warm, wet forests with huge plants." },
  // Vulpix (not Sandshrew): its artwork is in the bundled/curated sprite set,
  // and desert foxes fit the Sahara card.
  { name: "Desert", color: "bg-amber-500", scene: "sahara", examplePlace: "Sahara Desert", climate: "Hot and dry", pokemonId: 37, pokemonName: "Vulpix", fact: "Deserts are very dry places with little rain." },
  { name: "Ocean Reef", color: "bg-blue-500", scene: "reef", examplePlace: "Great Barrier Reef", climate: "Warm water", pokemonId: 131, pokemonName: "Lapras", fact: "Reefs are ocean homes with coral and many sea animals." },
  { name: "Mountain", color: "bg-orange-500", scene: "mountain", examplePlace: "Rocky Mountains", climate: "Cool and windy", pokemonId: 448, pokemonName: "Lucario", fact: "Mountains are tall rocky places high in the sky." },
  { name: "Grassland", color: "bg-lime-500", scene: "grassland", examplePlace: "Open grassland", climate: "Sunny and open", pokemonId: 25, pokemonName: "Pikachu", fact: "Grasslands are wide open fields of grass." },
  { name: "Snowy Land", color: "bg-cyan-500", scene: "antarctica", examplePlace: "Antarctica", climate: "Cold and icy", pokemonId: 87, pokemonName: "Dewgong", fact: "Some places are cold and covered in ice and snow." },
];

export default function RegionsPage() {
  const [, navigate] = useLocation();

  const tap = (h: Habitat) => { playTap(); void speakText(spokenText(`${h.name}. ${h.climate}.`), "en"); };

  return (
    <div className="flex flex-col h-full px-4 py-4">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate("/home")} className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center" aria-label="Back">
          <ArrowLeft size={40} />
        </button>
        <h1 className="text-3xl font-black text-green-600">Regions & Climates</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pb-6">
        {HABITATS.map((h, i) => (
          <motion.button
            key={h.name}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => tap(h)}
            className={`${h.color} rounded-3xl p-4 shadow-lg text-white min-h-[300px] text-left`}
          >
            <div className="relative mb-3">
              <GeoScene kind={h.scene} label={h.examplePlace} className="min-h-[220px]" />
              <img src={ARTWORK(h.pokemonId)} onError={onSpriteError} alt={h.pokemonName} className="absolute bottom-2 right-2 w-56 h-56 object-contain drop-shadow-xl" />
            </div>
            <div>
              <p className="text-3xl font-black">{h.name}</p>
              <p className="text-base font-black text-white/95">{h.climate}</p>
              <p className="text-base font-bold text-white/90 leading-snug">{h.fact}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
