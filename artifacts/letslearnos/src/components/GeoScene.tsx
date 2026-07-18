export type GeoSceneKind =
  | "sahara"
  | "desert"
  | "rainforest"
  | "savanna"
  | "antarctica"
  | "reef"
  | "ocean"
  | "mountain"
  | "forest"
  | "grassland"
  | "cave"
  | "globe-equator"
  | "north-pole";

export function GeoScene({
  kind,
  label,
  className = "",
}: {
  kind: GeoSceneKind;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-4 border-white shadow-inner min-h-[180px] ${className}`}
      role="img"
      aria-label={label}
    >
      {renderScene(kind)}
      <div className="absolute left-3 bottom-3 rounded-2xl bg-black/45 px-3 py-1 text-sm font-black text-white">
        {label}
      </div>
    </div>
  );
}

function renderScene(kind: GeoSceneKind) {
  switch (kind) {
    case "sahara":
    case "desert":
      return <DesertScene sahara={kind === "sahara"} />;
    case "rainforest":
      return <RainforestScene />;
    case "savanna":
      return <SavannaScene />;
    case "antarctica":
    case "north-pole":
      return <IceScene northPole={kind === "north-pole"} />;
    case "reef":
      return <ReefScene />;
    case "ocean":
      return <OceanScene />;
    case "mountain":
      return <MountainScene />;
    case "forest":
      return <ForestScene />;
    case "grassland":
      return <GrasslandScene />;
    case "cave":
      return <CaveScene />;
    case "globe-equator":
      return <GlobeEquatorScene />;
  }
}

function DesertScene({ sahara }: { sahara: boolean }) {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#67c7f7 0 46%, #f6cc73 47% 100%)" }}>
      <div className="absolute right-8 top-7 h-16 w-16 rounded-full bg-yellow-300 shadow-[0_0_28px_rgba(253,224,71,0.9)]" />
      <div className="absolute bottom-0 left-[-10%] h-28 w-[70%] rounded-t-[100%] bg-amber-400" />
      <div className="absolute bottom-0 right-[-8%] h-32 w-[78%] rounded-t-[100%] bg-yellow-500" />
      <div className="absolute bottom-4 left-[18%] h-20 w-[44%] rounded-t-[100%] bg-orange-300/70" />
      <div className="absolute bottom-12 right-[16%] h-16 w-3 rounded-full bg-green-700" />
      <div className="absolute bottom-18 right-[12%] h-3 w-8 rounded-full bg-green-700" />
      {sahara && <div className="absolute left-6 top-8 text-5xl font-black text-white/70">Sahara</div>}
    </div>
  );
}

function RainforestScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#78d6ff 0 38%, #236b3b 39% 100%)" }}>
      {["8%", "22%", "38%", "54%", "70%", "84%"].map((left, index) => (
        <div key={left}>
          <div className="absolute bottom-0 w-4 bg-amber-900" style={{ left, height: `${86 + index * 9}px` }} />
          <div className="absolute h-24 w-28 rounded-full bg-green-600" style={{ left: `calc(${left} - 40px)`, top: `${18 + (index % 2) * 12}px` }} />
          <div className="absolute h-20 w-24 rounded-full bg-lime-500" style={{ left: `calc(${left} - 18px)`, top: `${42 + (index % 2) * 8}px` }} />
        </div>
      ))}
      <div className="absolute bottom-0 left-[34%] h-24 w-16 rotate-12 rounded-t-full bg-cyan-300/80" />
      <div className="absolute bottom-0 left-[42%] h-20 w-20 rotate-12 rounded-t-full bg-blue-400/70" />
    </div>
  );
}

function SavannaScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#8bd4ff 0 46%, #dfbf55 47% 100%)" }}>
      <div className="absolute left-8 top-8 h-14 w-14 rounded-full bg-yellow-300" />
      <div className="absolute bottom-0 left-0 h-14 w-full bg-yellow-700/35" />
      <div className="absolute bottom-9 right-14 h-20 w-4 rounded-full bg-amber-950" />
      <div className="absolute bottom-24 right-7 h-8 w-24 rounded-full bg-green-800" />
      <div className="absolute bottom-21 right-4 h-8 w-20 rounded-full bg-green-700" />
      <div className="absolute bottom-10 left-9 h-1 w-28 rotate-12 bg-amber-900/30" />
      <div className="absolute bottom-16 left-24 h-1 w-24 -rotate-6 bg-amber-900/25" />
    </div>
  );
}

function IceScene({ northPole }: { northPole: boolean }) {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#8bdcff 0 48%, #e7fbff 49% 100%)" }}>
      <div className="absolute bottom-0 left-[-8%] h-24 w-[52%] rounded-t-[80%] bg-white" />
      <div className="absolute bottom-0 right-[-8%] h-28 w-[60%] rounded-t-[80%] bg-cyan-100" />
      <div className="absolute bottom-10 left-[36%] h-16 w-28 skew-x-[-18deg] bg-blue-100" />
      <div className="absolute bottom-16 left-[43%] h-8 w-20 skew-x-[-18deg] bg-white" />
      <div className="absolute right-6 top-7 rounded-2xl bg-white/65 px-3 py-1 text-lg font-black text-cyan-700">
        {northPole ? "North Pole" : "Antarctica"}
      </div>
    </div>
  );
}

function ReefScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#5fd4ff 0 28%, #0f7fc2 29% 100%)" }}>
      <div className="absolute left-0 top-12 h-10 w-full bg-white/30" />
      <div className="absolute bottom-0 left-0 h-16 w-full bg-yellow-200" />
      {["12%", "28%", "64%", "80%"].map((left, index) => (
        <div key={left} className="absolute bottom-12 h-14 w-5 rounded-t-full" style={{ left, background: index % 2 ? "#f472b6" : "#fb7185" }} />
      ))}
      <div className="absolute bottom-14 left-[42%] h-12 w-20 rounded-[50%] bg-orange-400" />
      <div className="absolute bottom-21 left-[48%] h-5 w-5 rounded-full bg-orange-200" />
      <div className="absolute right-8 top-20 h-5 w-12 rounded-[50%] bg-yellow-300" />
      <div className="absolute right-6 top-22 h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-yellow-300" />
    </div>
  );
}

function OceanScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#65d4ff 0 32%, #1d8bd1 33% 100%)" }}>
      {[44, 70, 96, 122].map((top) => (
        <div key={top} className="absolute left-0 h-5 w-full rounded-full bg-white/30" style={{ top }} />
      ))}
      <div className="absolute bottom-0 left-0 h-16 w-full bg-blue-800/25" />
    </div>
  );
}

function MountainScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#7dd3fc 0 48%, #86b46b 49% 100%)" }}>
      <div className="absolute bottom-0 left-2 h-0 w-0 border-x-[86px] border-b-[150px] border-x-transparent border-b-slate-600" />
      <div className="absolute bottom-0 right-4 h-0 w-0 border-x-[92px] border-b-[166px] border-x-transparent border-b-slate-700" />
      <div className="absolute bottom-[102px] left-[58px] h-0 w-0 border-x-[28px] border-b-[48px] border-x-transparent border-b-white" />
      <div className="absolute bottom-[118px] right-[62px] h-0 w-0 border-x-[30px] border-b-[48px] border-x-transparent border-b-white" />
      <div className="absolute bottom-0 left-0 h-12 w-full bg-green-600" />
    </div>
  );
}

function ForestScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#9bdcff 0 42%, #22683b 43% 100%)" }}>
      {["10%", "24%", "40%", "58%", "76%"].map((left, index) => (
        <div key={left}>
          <div className="absolute bottom-0 w-5 bg-amber-900" style={{ left, height: `${72 + index * 6}px` }} />
          <div className="absolute h-20 w-20 rounded-full bg-green-600" style={{ left: `calc(${left} - 28px)`, bottom: `${62 + index * 6}px` }} />
        </div>
      ))}
    </div>
  );
}

function GrasslandScene() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(#8bd4ff 0 50%, #70b943 51% 100%)" }}>
      <div className="absolute bottom-0 left-[-10%] h-20 w-[65%] rounded-t-[100%] bg-lime-500" />
      <div className="absolute bottom-0 right-[-8%] h-24 w-[72%] rounded-t-[100%] bg-green-500" />
      <div className="absolute bottom-16 left-10 h-1 w-16 rotate-45 bg-green-800/50" />
      <div className="absolute bottom-12 left-24 h-1 w-20 -rotate-12 bg-green-800/45" />
      <div className="absolute bottom-18 right-16 h-1 w-16 rotate-12 bg-green-800/45" />
    </div>
  );
}

function CaveScene() {
  return (
    <div className="absolute inset-0 bg-slate-500">
      <div className="absolute inset-x-0 bottom-0 h-20 bg-stone-700" />
      <div className="absolute bottom-0 left-[17%] h-40 w-[66%] rounded-t-full bg-slate-800" />
      <div className="absolute bottom-0 left-[31%] h-28 w-[38%] rounded-t-full bg-slate-950" />
      <div className="absolute left-5 top-8 h-16 w-24 rotate-12 rounded-full bg-slate-400" />
      <div className="absolute right-6 top-9 h-20 w-28 -rotate-12 rounded-full bg-slate-600" />
    </div>
  );
}

function GlobeEquatorScene() {
  return (
    <div className="absolute inset-0 bg-slate-900">
      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_32px_rgba(59,130,246,0.7)]">
        <div className="absolute left-7 top-8 h-12 w-14 rounded-full bg-green-500" />
        <div className="absolute right-8 top-12 h-16 w-10 rounded-full bg-green-600" />
        <div className="absolute left-14 bottom-8 h-10 w-16 rounded-full bg-lime-500" />
        <div className="absolute left-0 top-1/2 h-3 w-full -translate-y-1/2 bg-pokemon-red shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
      </div>
      <div className="absolute right-5 top-5 rounded-2xl bg-pokemon-red px-3 py-1 text-lg font-black text-white">
        Equator
      </div>
    </div>
  );
}
