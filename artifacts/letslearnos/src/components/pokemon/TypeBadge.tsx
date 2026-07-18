import { motion } from "framer-motion";

const typeColors: Record<string, string> = {
  normal: "bg-[#A8A77A] text-white",
  fire: "bg-[#EE8130] text-white",
  water: "bg-[#6390F0] text-white",
  electric: "bg-[#F7D02C] text-black",
  grass: "bg-[#7AC74C] text-white",
  ice: "bg-[#96D9D6] text-black",
  fighting: "bg-[#C22E28] text-white",
  poison: "bg-[#A33EA1] text-white",
  ground: "bg-[#E2BF65] text-black",
  flying: "bg-[#A98FF3] text-black",
  psychic: "bg-[#F95587] text-white",
  bug: "bg-[#A6B91A] text-white",
  rock: "bg-[#B6A136] text-white",
  ghost: "bg-[#735797] text-white",
  dragon: "bg-[#6F35FC] text-white",
  dark: "bg-[#705746] text-white",
  steel: "bg-[#B7B7CE] text-black",
  fairy: "bg-[#D685AD] text-black",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`${typeColors[type] || 'bg-gray-400 text-white'} px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider shadow-sm`}
    >
      {type}
    </span>
  );
}
