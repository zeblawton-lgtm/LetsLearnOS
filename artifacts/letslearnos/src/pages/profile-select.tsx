import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { api, type Profile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { playTap } from "@/lib/sound";

const SPRITE = ARTWORK;

export default function ProfileSelect() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { startSession, isLoading } = useSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    api.getProfiles()
      .then(setProfiles)
      .catch(() => {
        setError("Could not load profiles. Make sure the server is running.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (profile: Profile) => {
    playTap();
    try {
      await startSession(profile);
    } catch {
      // API may not be fully up right after boot — show the retryable error
      // screen instead of leaving the tap silently unhandled.
      setError("Could not start the session. Make sure the server is running.");
      return;
    }
    navigate("/home");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8 pt-[80px]">
        <div className="text-center">
          <div className="w-24 h-24 border-8 border-pokemon-red border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-2xl font-bold text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8 pb-8 pt-[80px]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">!</div>
          <h2 className="text-3xl font-black text-pokemon-red mb-4">Oops!</h2>
          <p className="text-xl text-gray-600 mb-6">{error}</p>
          <button
            className="min-h-[88px] min-w-[88px] bg-pokemon-red text-white text-2xl font-black px-8 py-4 rounded-3xl"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-8 pt-[96px]">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <img
          src={SPRITE(25)}
          onError={onSpriteError}
          alt="Pikachu"
          className="w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-4 drop-shadow-xl"
        />
        <h1 className="text-5xl font-black text-pokemon-red">LetsLearnOS</h1>
        <p className="text-2xl text-gray-600 mt-2 font-bold">Who is learning today?</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
        {profiles.map((profile, i) => (
          <motion.button
            key={profile.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelect(profile)}
            disabled={isLoading}
            className="w-full bg-white rounded-4xl shadow-xl border-4 border-gray-100 p-6 sm:p-8 flex flex-col items-center gap-4 hover:border-pokemon-yellow hover:shadow-2xl transition-all"
          >
            <div className="w-full max-w-[32rem] aspect-square rounded-full bg-pokemon-yellow/20 flex items-center justify-center overflow-hidden">
              <img
                src={SPRITE(profile.avatarPokemonId)}
                onError={onSpriteError}
                alt={profile.name}
                className="w-[88%] h-[88%] object-contain drop-shadow-md"
              />
            </div>
            <div>
              <p className="text-4xl font-black text-gray-800">{profile.name}</p>
              <p className="text-xl text-gray-500 font-bold mt-1">Age {profile.age}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center mt-8">
          <p className="text-xl text-gray-500">No profiles found.</p>
          <button
            className="mt-4 min-h-[88px] min-w-[88px] bg-pokemon-blue text-white text-xl font-black px-6 py-3 rounded-3xl"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
