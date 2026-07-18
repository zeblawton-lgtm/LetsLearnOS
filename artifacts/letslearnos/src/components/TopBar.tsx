import { useLocation } from "wouter";
import { useSession } from "@/context/SessionContext";
import { Home, Lock } from "lucide-react";

export function TopBar() {
  const { profile, openParentOverlay } = useSession();
  const [, navigate] = useLocation();

  if (!profile) return null;

  return (
    <div className="fixed top-[80px] left-0 right-0 z-40 bg-white shadow-sm px-4">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="w-[88px] h-[88px] rounded-2xl bg-pokemon-red/10 flex flex-col items-center justify-center flex-shrink-0"
          aria-label="Home"
        >
          <Home size={44} className="text-pokemon-red" />
          <span className="text-pokemon-red font-black text-sm">HOME</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={openParentOverlay}
          className="w-[88px] h-[88px] rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"
          aria-label="Parent controls"
        >
          <Lock size={32} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}
