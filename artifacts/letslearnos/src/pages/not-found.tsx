import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="text-8xl mb-4">?</div>
      <h2 className="text-4xl font-black text-pokemon-red mb-2">Page Not Found</h2>
      <button
        onClick={() => navigate("/")}
        className="mt-6 bg-pokemon-red text-white text-xl font-black px-8 py-4 rounded-3xl"
      >
        Go Home
      </button>
    </div>
  );
}
