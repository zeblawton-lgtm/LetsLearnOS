import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star, Trophy, Target } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";

interface Stats {
  totalCorrect: number;
  totalAttempts: number;
  moduleBreakdown: Record<string, { correct: number; total: number }>;
}

const MODULE_META: Record<string, { label: string; color: string }> = {
  math: { label: "Math", color: "bg-pokemon-red" },
  spanish: { label: "Spanish", color: "bg-pokemon-blue" },
  geography: { label: "World Explorer", color: "bg-green-500" },
  coloring: { label: "Coloring", color: "bg-pink-500" },
  tracing: { label: "Tracing", color: "bg-purple-500" },
  dots: { label: "Connect Dots", color: "bg-orange-500" },
  match: { label: "Memory Match", color: "bg-teal-500" },
};

const SPRITE = ARTWORK;

export default function Progress() {
  const { profile } = useSession();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    api.getStats(profile.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [profile]);

  const accuracy = stats && stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full px-4 py-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/home")} className="w-[88px] h-[88px] rounded-2xl bg-gray-100 flex items-center justify-center" aria-label="Back">
          <ArrowLeft size={40} />
        </button>
        <h1 className="text-3xl font-black text-pokemon-red">My Progress</h1>
      </div>

      {profile && (
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-md p-6 mb-5 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left"
        >
          <img src={SPRITE(profile.avatarPokemonId)} onError={onSpriteError} alt={profile.name} className="w-60 h-60 sm:w-72 sm:h-72 object-contain" />
          <div>
            <p className="text-3xl font-black text-gray-800">{profile.name}</p>
            <p className="text-xl text-gray-500 font-bold">Age {profile.age} Trainer</p>
          </div>
          <div className="sm:ml-auto text-center sm:text-right">
            <Trophy size={50} className="text-pokemon-yellow mx-auto mb-1" />
            <p className="text-2xl font-black text-pokemon-yellow">{accuracy}%</p>
            <p className="text-sm text-gray-500 font-bold">accuracy</p>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-16 h-16 border-6 border-pokemon-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="bg-pokemon-red/10 rounded-3xl p-5 text-center">
              <Target size={45} className="text-pokemon-red mx-auto mb-2" />
              <p className="text-4xl font-black text-pokemon-red">{stats?.totalAttempts ?? 0}</p>
              <p className="text-lg font-bold text-gray-600">Questions</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="bg-green-100 rounded-3xl p-5 text-center">
              <Star size={45} className="text-green-600 mx-auto mb-2 fill-green-600" />
              <p className="text-4xl font-black text-green-600">{stats?.totalCorrect ?? 0}</p>
              <p className="text-lg font-bold text-gray-600">Correct</p>
            </motion.div>
          </div>

          <div className="flex flex-col gap-4">
            {Object.entries(MODULE_META).map(([mod, meta], i) => {
              const breakdown = stats?.moduleBreakdown[mod];
              const pct = breakdown && breakdown.total > 0
                ? Math.round((breakdown.correct / breakdown.total) * 100) : 0;
              return (
                <motion.div
                  key={mod}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className="bg-white rounded-3xl shadow-sm p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`${meta.color} text-white text-base font-black px-4 py-1 rounded-full`}>
                      {meta.label}
                    </span>
                    <span className="text-2xl font-black text-gray-700">
                      {breakdown ? `${breakdown.correct}/${breakdown.total}` : "0/0"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className={`${meta.color} h-4 rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-right text-sm font-bold text-gray-500 mt-1">{pct}%</p>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
