import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, X, Search } from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { pokedex, TYPE_COLORS, type PokedexEntry } from "@/content/pokedex";
import { playTap } from "@/lib/sound";
import { speakText } from "@/lib/tts";
import { spokenName } from "@/lib/pronounce";
import { markPokemonLearned } from "@/lib/storage";
import { GeoScene } from "@/components/GeoScene";
import { getPokemonHabitat } from "@/lib/pokemonHabitat";

export default function PokedexPage() {
  const [, navigate] = useLocation();
  const [active, setActive] = useState<PokedexEntry | null>(null);
  const [query, setQuery] = useState("");

  const open = (p: PokedexEntry) => {
    playTap();
    void speakText(spokenName(p.name), "en");
    markPokemonLearned(p.id);
    setActive(p);
  };
  const activeHabitat = active ? getPokemonHabitat(active.id, active.types) : null;

  // Filter by name, number, or type. 1025 entries, so match is cheap but we
  // memoize to avoid re-filtering on unrelated re-renders.
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return pokedex;
    return pokedex.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      String(p.id) === term ||
      p.types.some((t) => t.toLowerCase() === term)
    );
  }, [query]);

  return (
    <div className="flex flex-col h-full px-4 py-4">
      <div className="flex items-center gap-4 mb-3">
        <button onClick={() => navigate("/home")} className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0" aria-label="Back">
          <ArrowLeft size={40} />
        </button>
        <h1 className="text-3xl font-black text-pokemon-red">Pokédex</h1>
        <span className="ml-auto text-base font-bold text-gray-400">{results.length} of {pokedex.length}</span>
      </div>

      <div className="relative mb-4">
        <Search size={31} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, number, or type…"
          className="w-full min-h-[88px] bg-white border-4 border-gray-200 rounded-3xl py-4 pl-14 pr-28 text-xl font-bold text-gray-800 focus:border-pokemon-blue outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-[88px] h-[88px] rounded-full bg-gray-100 flex items-center justify-center" aria-label="Clear">
            <X size={31} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto pb-6">
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => open(p)}
            className="bg-white rounded-3xl shadow border-4 border-gray-100 p-3 flex flex-col items-center gap-1 min-h-[140px] active:scale-95 transition-transform"
          >
            <img
              src={ARTWORK(p.id)}
              onError={onSpriteError}
              alt={p.name}
              loading="lazy"
              className="w-40 h-40 object-contain drop-shadow"
            />
            <span className="text-lg font-black text-gray-800 text-center leading-tight">{p.name}</span>
            <span className="text-xs font-bold text-gray-400">#{p.id}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="col-span-full text-center text-xl font-bold text-gray-400 py-10">
            No Pokémon found. Try another name or number!
          </p>
        )}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 pt-[96px]"
            onClick={(e) => { if (e.target === e.currentTarget) setActive(null); }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="bg-white rounded-4xl w-full max-w-sm max-h-[calc(100vh-120px)] overflow-y-auto p-6 text-center relative"
            >
              <button onClick={() => setActive(null)} className="absolute top-4 right-4 w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center" aria-label="Close">
                <X size={44} />
              </button>
              <img src={ARTWORK(active.id)} onError={onSpriteError} alt={active.name} className="w-56 h-56 object-contain mx-auto drop-shadow-xl mb-2" />
              <h2 className="text-4xl font-black text-gray-800">{active.name}</h2>
              <div className="flex gap-2 justify-center my-3">
                {active.types.map((t) => (
                  <span key={t} className={`${TYPE_COLORS[t] ?? "bg-gray-400"} text-white text-base font-black px-4 py-1 rounded-full`}>{t}</span>
                ))}
              </div>
              {activeHabitat && (
                <div className="my-4 rounded-3xl bg-green-50 p-3 text-left">
                  <GeoScene
                    kind={activeHabitat.scene}
                    label={activeHabitat.examplePlace}
                    className="mb-3 min-h-[150px]"
                  />
                  <p className="text-sm font-black uppercase text-green-700">Where it might live</p>
                  <p className="text-2xl font-black text-gray-800">{activeHabitat.biome}</p>
                  <p className="text-lg font-bold text-gray-600">Climate: {activeHabitat.climate}</p>
                  <p className="mt-1 text-base font-bold text-gray-600 leading-snug">{activeHabitat.note}</p>
                </div>
              )}
              <p className="text-xl font-bold text-gray-600 leading-snug">{active.fact}</p>
              <button
                onClick={() => void speakText(spokenName(active.name), "en")}
                className="mt-5 bg-pokemon-blue text-white text-xl font-black px-8 py-4 rounded-3xl min-h-[88px]"
              >
                🔊 Say the name
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
