// ---------------------------------------------------------------------------
// WaldoBackdrop — the illustrated landscape behind each Hide & Seek scene
// (ADR-020). One hand-authored SVG per theme, all on a shared 3200x1000
// canvas (3.2:1, matching WaldoScene's scene box exactly, so the sprite
// placements in content/waldo-scenes.ts line up with the art's ground/water/
// sky bands). Everything is vector: it stays crisp at 4K and costs nothing
// offline. Small helper components (Cloud, Pine, House...) are mapped over
// position arrays to give each scene Waldo-ish visual density without
// thousands of hand-written elements.
//
// Gradient/filter ids are prefixed per-theme (e.g. "bch-sky") — only one
// backdrop is mounted at a time, but unique ids keep the SVGs safe to mount
// together (e.g. if a future preview strip shows thumbnails of all five).
// ---------------------------------------------------------------------------

import type { WaldoTheme } from "@/content/waldo-scenes";
import type { JSX } from "react";

// --------------------------------------------------------------------------
// Shared small parts
// --------------------------------------------------------------------------

function Cloud({ x, y, s, tint = "#ffffff", opacity = 0.95 }: { x: number; y: number; s: number; tint?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <ellipse cx="0" cy="0" rx="70" ry="34" fill={tint} />
      <ellipse cx="-52" cy="12" rx="44" ry="24" fill={tint} />
      <ellipse cx="54" cy="10" rx="48" ry="26" fill={tint} />
      <ellipse cx="8" cy="-20" rx="40" ry="26" fill={tint} />
    </g>
  );
}

function Sun({ x, y, r, core, halo }: { x: number; y: number; r: number; core: string; halo: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 2.1} fill={halo} opacity="0.25" />
      <circle cx={x} cy={y} r={r * 1.45} fill={halo} opacity="0.35" />
      <circle cx={x} cy={y} r={r} fill={core} />
    </g>
  );
}

function Pine({ x, y, s, leaf, snow }: { x: number; y: number; s: number; leaf: string; snow?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-8" y="52" width="16" height="34" rx="5" fill="#7a5a3a" />
      <path d="M0,-70 L46,0 L-46,0 Z" fill={leaf} />
      <path d="M0,-38 L56,42 L-56,42 Z" fill={leaf} />
      <path d="M0,-2 L64,80 L-64,80 Z" fill={leaf} />
      {snow && (
        <>
          <path d="M0,-70 L28,-27 L-28,-27 Z" fill={snow} opacity="0.9" />
          <path d="M0,-38 L30,5 L-30,5 Z" fill={snow} opacity="0.75" />
        </>
      )}
    </g>
  );
}

function Flower({ x, y, s, petals, heart }: { x: number; y: number; s: number; petals: string; heart: string }) {
  const petal = (deg: number) => (
    <ellipse key={deg} cx="0" cy="-26" rx="15" ry="26" fill={petals} transform={`rotate(${deg})`} />
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="10" width="8" height="60" rx="4" fill="#4d9645" />
      <ellipse cx="-18" cy="46" rx="18" ry="9" fill="#5aab52" transform="rotate(-24 -18 46)" />
      <ellipse cx="18" cy="56" rx="18" ry="9" fill="#5aab52" transform="rotate(24 18 56)" />
      <g>{[0, 60, 120, 180, 240, 300].map(petal)}</g>
      <circle cx="0" cy="0" r="15" fill={heart} />
    </g>
  );
}

// --------------------------------------------------------------------------
// Theme 1 — Sunny Beach Party
// --------------------------------------------------------------------------

function Palm({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  const frond = (deg: number) => (
    <path key={deg} d="M0,0 Q60,-38 128,-20 Q66,-10 6,14 Z" fill="#3f9b48" transform={`rotate(${deg})`} />
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-12,190 Q-26,80 8,0 L26,6 Q0,90 14,190 Z" fill="#a9784a" />
      <g transform="translate(16 2)">{[-160, -120, -75, -30, 10].map(frond)}</g>
      <circle cx="6" cy="10" r="12" fill="#8a5a2f" />
      <circle cx="28" cy="16" r="11" fill="#8a5a2f" />
    </g>
  );
}

function Umbrella({ x, y, s, a, b }: { x: number; y: number; s: number; a: string; b: string }) {
  const wedge = (i: number) => {
    const from = -90 + i * 30 - 90;
    const to = from + 30;
    const rad = (d: number) => (d * Math.PI) / 180;
    const x1 = Math.cos(rad(from)) * 110;
    const y1 = Math.sin(rad(from)) * 110;
    const x2 = Math.cos(rad(to)) * 110;
    const y2 = Math.sin(rad(to)) * 110;
    return <path key={i} d={`M0,0 L${x1},${y1} A110,110 0 0 1 ${x2},${y2} Z`} fill={i % 2 ? a : b} />;
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="-4" width="8" height="150" rx="4" fill="#8a6a4a" />
      <g>{[0, 1, 2, 3, 4, 5].map(wedge)}</g>
      <circle cx="0" cy="-112" r="8" fill={a} />
    </g>
  );
}

function Sandcastle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-90" y="-10" width="180" height="70" rx="8" fill="#eec98a" />
      <rect x="-120" y="-46" width="60" height="106" rx="8" fill="#f3d69e" />
      <rect x="60" y="-46" width="60" height="106" rx="8" fill="#f3d69e" />
      <rect x="-34" y="-70" width="68" height="130" rx="8" fill="#f8e0b0" />
      <path d="M-120,-46 L-90,-72 L-60,-46 Z" fill="#e5b877" />
      <path d="M60,-46 L90,-72 L120,-46 Z" fill="#e5b877" />
      <path d="M-34,-70 L0,-100 L34,-70 Z" fill="#eec98a" />
      <rect x="-2" y="-140" width="4" height="42" fill="#8a6a4a" />
      <path d="M2,-138 L34,-128 L2,-118 Z" fill="#ff5a5a" />
      <rect x="-14" y="16" width="28" height="44" rx="12" fill="#b98a55" />
      <circle cx="-90" cy="-56" r="6" fill="#f8e0b0" />
      <circle cx="90" cy="-56" r="6" fill="#f8e0b0" />
    </g>
  );
}

function Sailboat({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-70,0 L70,0 L44,34 L-44,34 Z" fill="#c0503a" />
      <rect x="-3" y="-104" width="6" height="104" fill="#7a5a3a" />
      <path d="M3,-100 L64,-8 L3,-8 Z" fill="#ffffff" />
      <path d="M-3,-92 L-52,-8 L-3,-8 Z" fill="#ffd23f" />
    </g>
  );
}

function BeachBackdrop() {
  return (
    <>
      <defs>
        <linearGradient id="bch-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#66bdf5" />
          <stop offset="70%" stopColor="#b3e3ff" />
          <stop offset="100%" stopColor="#e8f9ff" />
        </linearGradient>
        <linearGradient id="bch-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a93cc" />
          <stop offset="100%" stopColor="#63cbe8" />
        </linearGradient>
        <linearGradient id="bch-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9b8" />
          <stop offset="100%" stopColor="#f0cf8b" />
        </linearGradient>
      </defs>
      <rect width="3200" height="560" fill="url(#bch-sky)" />
      <Sun x={2680} y={150} r={80} core="#ffd94f" halo="#ffe9a0" />
      <Cloud x={420} y={120} s={1.3} />
      <Cloud x={1250} y={80} s={0.9} opacity={0.85} />
      <Cloud x={2050} y={140} s={1.1} />
      <Cloud x={2980} y={90} s={0.8} opacity={0.8} />
      {/* distant island */}
      <ellipse cx="2350" cy="480" rx="190" ry="42" fill="#e8c98a" />
      <Palm x={2320} y={330} s={0.75} />
      {/* sea */}
      <rect y="440" width="3200" height="240" fill="url(#bch-sea)" />
      {[
        [180, 500, 90], [520, 540, 120], [900, 490, 80], [1350, 555, 110],
        [1750, 505, 95], [2150, 560, 130], [2600, 520, 85], [2950, 565, 100],
      ].map(([wx, wy, wr], i) => (
        <ellipse key={i} cx={wx} cy={wy} rx={wr} ry="9" fill="#ffffff" opacity="0.4" />
      ))}
      <Sailboat x={760} y={470} s={0.9} />
      {/* sand */}
      <path d="M0,640 Q800,600 1600,636 Q2400,672 3200,628 L3200,1000 L0,1000 Z" fill="url(#bch-sand)" />
      {[
        [240, 760], [610, 880], [1060, 800], [1480, 920], [1900, 780],
        [2260, 900], [2680, 820], [3020, 940], [420, 950], [1700, 860], [2900, 700],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="7" fill="#d9b164" opacity="0.5" />
      ))}
      <Palm x={140} y={480} s={1.25} />
      <Palm x={3070} y={500} s={1.1} flip />
      <Umbrella x={950} y={700} s={1.0} a="#ff5a5a" b="#ffffff" />
      <Umbrella x={2420} y={730} s={0.9} a="#2a93cc" b="#ffd23f" />
      <Sandcastle x={1680} y={820} s={1.0} />
      {/* towels + beach ball */}
      <rect x="1120" y="850" width="150" height="80" rx="12" fill="#ff8fd0" transform="rotate(-6 1195 890)" />
      <rect x="2620" y="880" width="150" height="76" rx="12" fill="#7ac74f" transform="rotate(5 2695 918)" />
      <g transform="translate(1310 900)">
        <circle r="34" fill="#ffffff" />
        <path d="M-34,0 A34,34 0 0 1 34,0 L0,0 Z" fill="#ff5a5a" transform="rotate(30)" />
        <path d="M-34,0 A34,34 0 0 1 34,0 L0,0 Z" fill="#2a93cc" transform="rotate(150)" />
        <circle r="6" fill="#ffd23f" />
      </g>
    </>
  );
}

// --------------------------------------------------------------------------
// Theme 2 — Flower Garden Festival
// --------------------------------------------------------------------------

function Butterfly({ x, y, s, wing }: { x: number; y: number; s: number; wing: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-11" cy="0" rx="12" ry="17" fill={wing} transform="rotate(-20 -11 0)" />
      <ellipse cx="11" cy="0" rx="12" ry="17" fill={wing} transform="rotate(20 11 0)" />
      <rect x="-2.5" y="-12" width="5" height="24" rx="2.5" fill="#5a4632" />
    </g>
  );
}

function GardenBackdrop() {
  return (
    <>
      <defs>
        <linearGradient id="gdn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd4ff" />
          <stop offset="100%" stopColor="#eafbe4" />
        </linearGradient>
        <linearGradient id="gdn-pond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6fd0ea" />
          <stop offset="100%" stopColor="#3fa8d6" />
        </linearGradient>
      </defs>
      <rect width="3200" height="480" fill="url(#gdn-sky)" />
      <Sun x={330} y={140} r={70} core="#ffe066" halo="#fff2b0" />
      <Cloud x={980} y={110} s={1.0} />
      <Cloud x={1900} y={70} s={0.8} opacity={0.85} />
      <Cloud x={2650} y={130} s={1.15} />
      {/* rolling hills, back to front */}
      <path d="M0,470 Q550,330 1150,440 Q1750,545 2350,420 Q2800,335 3200,430 L3200,1000 L0,1000 Z" fill="#a8dc78" />
      <path d="M0,640 Q700,520 1500,620 Q2300,715 3200,590 L3200,1000 L0,1000 Z" fill="#8fd05e" />
      <path d="M0,830 Q900,740 1800,820 Q2600,885 3200,800 L3200,1000 L0,1000 Z" fill="#7cc24f" />
      {/* trellis archway */}
      <g transform="translate(2170 470)">
        <path d="M-130,220 Q-130,-90 0,-90 Q130,-90 130,220" fill="none" stroke="#c79ce0" strokeWidth="26" />
        <path d="M-130,220 Q-130,-90 0,-90 Q130,-90 130,220" fill="none" stroke="#b384d1" strokeWidth="8" strokeDasharray="26 30" />
        {[[-118, 60], [-92, -30], [0, -84], [92, -30], [118, 60]].map(([rx, ry], i) => (
          <circle key={i} cx={rx} cy={ry} r="16" fill={i % 2 ? "#ff8fd0" : "#ffd23f"} />
        ))}
      </g>
      {/* pond with lilypads */}
      <ellipse cx="1380" cy="655" rx="330" ry="105" fill="url(#gdn-pond)" />
      <ellipse cx="1380" cy="655" rx="330" ry="105" fill="none" stroke="#7cc24f" strokeWidth="12" opacity="0.6" />
      <ellipse cx="1290" cy="625" rx="120" ry="16" fill="#ffffff" opacity="0.3" />
      {[[1230, 690, 1], [1480, 640, 0.8], [1550, 700, 0.65]].map(([lx, ly, ls], i) => (
        <g key={i} transform={`translate(${lx} ${ly}) scale(${ls})`}>
          <path d="M0,0 m-48,0 a48,30 0 1 0 96,0 a48,30 0 1 0 -96,0 M0,0 L34,-22 L34,10 Z" fill="#3f9b48" fillRule="evenodd" />
        </g>
      ))}
      {/* picnic blanket */}
      <g transform="translate(660 810) rotate(-4)">
        <rect x="-140" y="-80" width="280" height="160" rx="14" fill="#ff6f6f" />
        <rect x="-140" y="-80" width="140" height="80" rx="14" fill="#ffffff" opacity="0.55" />
        <rect x="0" y="0" width="140" height="80" rx="14" fill="#ffffff" opacity="0.55" />
        <circle cx="-50" cy="10" r="26" fill="#f8e0b0" />
        <rect x="20" y="-46" width="60" height="40" rx="8" fill="#a9784a" />
      </g>
      {/* flower rows — big blooms the grass-types hide among */}
      <Flower x={130} y={700} s={1.35} petals="#ff8fd0" heart="#ffd23f" />
      <Flower x={330} y={790} s={1.05} petals="#ffd23f" heart="#e2762f" />
      <Flower x={470} y={620} s={0.9} petals="#ffffff" heart="#ffd23f" />
      <Flower x={950} y={640} s={1.1} petals="#c79ce0" heart="#fff2b0" />
      <Flower x={1120} y={870} s={1.3} petals="#ff6f6f" heart="#ffd23f" />
      <Flower x={1780} y={700} s={1.15} petals="#ffd23f" heart="#e2762f" />
      <Flower x={1950} y={880} s={0.95} petals="#ff8fd0" heart="#fff2b0" />
      <Flower x={2450} y={640} s={1.0} petals="#ffffff" heart="#ffd23f" />
      <Flower x={2620} y={860} s={1.25} petals="#c79ce0" heart="#ffd23f" />
      <Flower x={2960} y={730} s={1.1} petals="#ff6f6f" heart="#fff2b0" />
      <Flower x={3120} y={900} s={0.9} petals="#ffd23f" heart="#e2762f" />
      {/* tiny tulip rows for midground texture */}
      {[
        [220, 905, "#ff6f6f"], [560, 940, "#ffd23f"], [840, 620, "#ff8fd0"], [1240, 930, "#c79ce0"],
        [1620, 900, "#ff6f6f"], [2080, 640, "#ffd23f"], [2320, 930, "#ff8fd0"], [2820, 940, "#ffd23f"],
      ].map(([tx, ty, tc], i) => (
        <g key={i} transform={`translate(${tx} ${ty})`}>
          <rect x="-3" y="0" width="6" height="34" fill="#4d9645" />
          <path d="M-14,-6 Q-14,-30 0,-24 Q14,-30 14,-6 Q7,4 0,-2 Q-7,4 -14,-6 Z" fill={tc as string} />
        </g>
      ))}
      <Butterfly x={760} y={300} s={1.1} wing="#ff8fd0" />
      <Butterfly x={1560} y={220} s={0.9} wing="#8fd4ff" />
      <Butterfly x={2760} y={280} s={1.0} wing="#ffd23f" />
    </>
  );
}

// --------------------------------------------------------------------------
// Theme 3 — Snowy Mountain Village
// --------------------------------------------------------------------------

function Cabin({ x, y, s, wall, roof }: { x: number; y: number; s: number; wall: string; roof: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-90" y="-20" width="180" height="120" rx="8" fill={wall} />
      <path d="M-108,-16 L0,-96 L108,-16 Z" fill={roof} />
      <path d="M-108,-16 L0,-96 L108,-16 L108,-34 L0,-112 L-108,-34 Z" fill="#ffffff" opacity="0.9" />
      <rect x="-20" y="30" width="40" height="70" rx="6" fill="#5a3f2a" />
      <rect x="-66" y="6" width="34" height="34" rx="6" fill="#ffd76a" />
      <rect x="32" y="6" width="34" height="34" rx="6" fill="#ffd76a" />
      <rect x="44" y="-84" width="22" height="46" fill="#8a5a3a" />
      <ellipse cx="55" cy="-96" rx="14" ry="9" fill="#e8f0fa" opacity="0.85" />
    </g>
  );
}

function Snowman({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="40" r="46" fill="#ffffff" />
      <circle cx="0" cy="-22" r="34" fill="#ffffff" />
      <circle cx="0" cy="-70" r="24" fill="#ffffff" />
      <rect x="-20" y="-108" width="40" height="10" rx="4" fill="#3a3f52" />
      <rect x="-13" y="-134" width="26" height="28" rx="4" fill="#3a3f52" />
      <circle cx="-8" cy="-74" r="3.5" fill="#3a3f52" />
      <circle cx="8" cy="-74" r="3.5" fill="#3a3f52" />
      <path d="M0,-68 L20,-62 L0,-58 Z" fill="#ff8c42" />
      <path d="M-30,-30 L-62,-52" stroke="#7a5a3a" strokeWidth="6" strokeLinecap="round" />
      <path d="M30,-30 L62,-52" stroke="#7a5a3a" strokeWidth="6" strokeLinecap="round" />
      <path d="M-16,-46 Q0,-38 16,-46" stroke="#ff5a5a" strokeWidth="10" fill="none" strokeLinecap="round" />
    </g>
  );
}

function SnowBackdrop() {
  return (
    <>
      <defs>
        <linearGradient id="snw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fa8dd" />
          <stop offset="65%" stopColor="#c3d8f2" />
          <stop offset="100%" stopColor="#ffe4ec" />
        </linearGradient>
        <linearGradient id="snw-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dbe8f7" />
        </linearGradient>
      </defs>
      <rect width="3200" height="560" fill="url(#snw-sky)" />
      <Sun x={520} y={160} r={60} core="#fff2cc" halo="#ffe4ec" />
      {/* mountain ranges */}
      <path d="M0,520 L340,220 L620,470 L900,180 L1220,520 Z" fill="#a8c2e2" />
      <path d="M900,180 L1000,290 L940,300 L880,260 L820,290 Z" fill="#ffffff" />
      <path d="M340,220 L420,320 L360,330 L300,300 Z" fill="#ffffff" />
      <path d="M1100,520 L1500,150 L1980,520 Z" fill="#8fabd1" />
      <path d="M1500,150 L1610,270 L1540,290 L1470,250 L1400,280 Z" fill="#ffffff" />
      <path d="M1900,520 L2280,240 L2620,500 L2900,200 L3200,520 Z" fill="#a8c2e2" />
      <path d="M2900,200 L2990,300 L2930,310 L2860,270 Z" fill="#ffffff" />
      <path d="M2280,240 L2360,340 L2290,350 L2230,310 Z" fill="#ffffff" />
      {/* snowfield */}
      <path d="M0,560 Q800,510 1600,556 Q2400,600 3200,545 L3200,1000 L0,1000 Z" fill="url(#snw-ground)" />
      <ellipse cx="700" cy="900" rx="420" ry="60" fill="#ffffff" opacity="0.8" />
      <ellipse cx="2500" cy="930" rx="480" ry="70" fill="#ffffff" opacity="0.8" />
      {/* frozen pond */}
      <ellipse cx="1620" cy="690" rx="360" ry="100" fill="#bfe0f2" />
      <ellipse cx="1620" cy="690" rx="360" ry="100" fill="none" stroke="#ffffff" strokeWidth="14" opacity="0.9" />
      <path d="M1440,660 L1560,700 L1520,660 L1680,710" stroke="#e6f4fc" strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="1520" cy="660" rx="130" ry="20" fill="#ffffff" opacity="0.5" />
      {/* village */}
      <Cabin x={420} y={640} s={1.1} wall="#a2543c" roof="#7c3f2d" />
      <Cabin x={980} y={700} s={0.9} wall="#5a7a9e" roof="#41597a" />
      <Cabin x={2280} y={640} s={1.15} wall="#8a6a4a" roof="#6a4a32" />
      <Cabin x={2860} y={720} s={0.95} wall="#a2543c" roof="#7c3f2d" />
      {/* pines */}
      <Pine x={130} y={600} s={1.2} leaf="#3f7a5a" snow="#ffffff" />
      <Pine x={250} y={700} s={0.9} leaf="#356a4d" snow="#ffffff" />
      <Pine x={760} y={620} s={1.0} leaf="#3f7a5a" snow="#ffffff" />
      <Pine x={1180} y={590} s={0.85} leaf="#356a4d" snow="#ffffff" />
      <Pine x={2050} y={610} s={1.1} leaf="#3f7a5a" snow="#ffffff" />
      <Pine x={2600} y={590} s={0.9} leaf="#356a4d" snow="#ffffff" />
      <Pine x={3080} y={620} s={1.25} leaf="#3f7a5a" snow="#ffffff" />
      <Snowman x={1900} y={850} s={1.0} />
      {/* falling snow */}
      {[
        [140, 180], [420, 420], [700, 120], [980, 320], [1240, 200], [1500, 420],
        [1760, 140], [2040, 340], [2320, 180], [2580, 400], [2840, 240], [3100, 380],
        [280, 640], [860, 800], [1380, 880], [2180, 780], [2720, 860], [560, 260],
        [1640, 300], [2960, 140],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 9 : 6} fill="#ffffff" opacity="0.85" />
      ))}
    </>
  );
}

// --------------------------------------------------------------------------
// Theme 4 — Busy Market Town
// --------------------------------------------------------------------------

function House({ x, y, s, wall, roof }: { x: number; y: number; s: number; wall: string; roof: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-80" y="-60" width="160" height="170" rx="6" fill={wall} />
      <path d="M-96,-56 L0,-130 L96,-56 Z" fill={roof} />
      <rect x="-56" y="-30" width="36" height="36" rx="5" fill="#ffffff" opacity="0.85" />
      <rect x="20" y="-30" width="36" height="36" rx="5" fill="#ffffff" opacity="0.85" />
      <rect x="-56" y="34" width="36" height="36" rx="5" fill="#ffffff" opacity="0.85" />
      <rect x="18" y="30" width="40" height="80" rx="6" fill="#6a4a32" />
      <circle cx="26" cy="72" r="4" fill="#ffd23f" />
    </g>
  );
}

function Stall({ x, y, s, a, b }: { x: number; y: number; s: number; a: string; b: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-104" y="-10" width="16" height="120" fill="#8a6a4a" />
      <rect x="88" y="-10" width="16" height="120" fill="#8a6a4a" />
      {/* striped awning */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={-120 + i * 40} y="-60" width="40" height="44" fill={i % 2 ? a : b} />
      ))}
      <path d="M-120,-16 Q-100,4 -80,-16 Q-60,4 -40,-16 Q-20,4 0,-16 Q20,4 40,-16 Q60,4 80,-16 Q100,4 120,-16 L120,-24 L-120,-24 Z" fill={a} />
      <rect x="-112" y="52" width="224" height="60" rx="8" fill="#b98a55" />
      {/* produce boxes */}
      <rect x="-96" y="24" width="60" height="30" rx="5" fill="#8a5a2f" />
      <rect x="36" y="24" width="60" height="30" rx="5" fill="#8a5a2f" />
      {[-80, -66, -52].map((cx, i) => (
        <circle key={i} cx={cx} cy={24} r="9" fill={i % 2 ? "#ff5a5a" : "#ff8c42"} />
      ))}
      {[52, 66, 80].map((cx, i) => (
        <circle key={i} cx={cx} cy={24} r="9" fill={i % 2 ? "#7ac74f" : "#ffd23f"} />
      ))}
    </g>
  );
}

function Bunting({ x1, x2, y, sag, colors }: { x1: number; x2: number; y: number; sag: number; colors: string[] }) {
  const flags: JSX.Element[] = [];
  const n = 9;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const fx = x1 + (x2 - x1) * t;
    const fy = y + Math.sin(Math.PI * t) * sag;
    flags.push(<path key={i} d={`M${fx - 16},${fy} L${fx + 16},${fy} L${fx},${fy + 30} Z`} fill={colors[i % colors.length]} />);
  }
  return (
    <g>
      <path d={`M${x1},${y} Q${(x1 + x2) / 2},${y + sag * 2} ${x2},${y}`} stroke="#8a6a4a" strokeWidth="5" fill="none" />
      {flags}
    </g>
  );
}

function Fountain({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="60" rx="150" ry="44" fill="#9aa8b8" />
      <ellipse cx="0" cy="50" rx="126" ry="34" fill="#63cbe8" />
      <rect x="-16" y="-60" width="32" height="110" rx="8" fill="#b8c4d2" />
      <ellipse cx="0" cy="-58" rx="52" ry="14" fill="#9aa8b8" />
      <path d="M0,-64 Q-60,-30 -80,30" stroke="#aee6ff" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M0,-64 Q60,-30 80,30" stroke="#aee6ff" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M0,-64 Q0,-20 0,26" stroke="#aee6ff" strokeWidth="9" fill="none" strokeLinecap="round" />
      <ellipse cx="-46" cy="44" rx="30" ry="7" fill="#ffffff" opacity="0.5" />
    </g>
  );
}

function MarketBackdrop() {
  return (
    <>
      <defs>
        <linearGradient id="mkt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffc98a" />
          <stop offset="100%" stopColor="#fff3d6" />
        </linearGradient>
        <linearGradient id="mkt-street" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8d5b8" />
          <stop offset="100%" stopColor="#d4ba92" />
        </linearGradient>
      </defs>
      <rect width="3200" height="580" fill="url(#mkt-sky)" />
      <Sun x={290} y={150} r={70} core="#ffb347" halo="#ffd9a0" />
      <Cloud x={1150} y={100} s={0.9} tint="#fff0dc" />
      <Cloud x={2350} y={130} s={1.1} tint="#fff0dc" />
      <Cloud x={2950} y={70} s={0.75} tint="#fff0dc" opacity={0.85} />
      {/* house row */}
      <House x={280} y={430} s={1.15} wall="#e8875a" roof="#a2543c" />
      <House x={640} y={450} s={1.0} wall="#f2c14e" roof="#c08a2f" />
      <House x={1000} y={430} s={1.2} wall="#7fb5b5" roof="#4d7f7f" />
      <House x={1420} y={455} s={0.95} wall="#c79ce0" roof="#8f6aab" />
      <House x={1820} y={435} s={1.15} wall="#ff8fa5" roof="#c05a72" />
      <House x={2250} y={450} s={1.0} wall="#8fbf6f" roof="#5f8f47" />
      <House x={2650} y={430} s={1.2} wall="#f2c14e" roof="#c08a2f" />
      <House x={3040} y={455} s={0.95} wall="#e8875a" roof="#a2543c" />
      {/* street */}
      <path d="M0,585 Q900,555 1700,580 Q2500,605 3200,570 L3200,1000 L0,1000 Z" fill="url(#mkt-street)" />
      {[
        [200, 700], [480, 830], [760, 740], [1040, 900], [1320, 760], [1600, 870],
        [1880, 720], [2160, 890], [2440, 760], [2720, 850], [3000, 720], [340, 950],
        [900, 620], [1750, 950], [2600, 630], [3120, 900],
      ].map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="34" ry="12" fill="#c4a87e" opacity="0.55" />
      ))}
      <Bunting x1={120} x2={1080} y={190} sag={55} colors={["#ff5a5a", "#ffd23f", "#63cbe8", "#7ac74f"]} />
      <Bunting x1={1080} x2={2100} y={175} sag={65} colors={["#ff8fd0", "#63cbe8", "#ffd23f"]} />
      <Bunting x1={2100} x2={3080} y={190} sag={55} colors={["#7ac74f", "#ff5a5a", "#c79ce0", "#ffd23f"]} />
      <Fountain x={1920} y={600} s={1.0} />
      <Stall x={560} y={660} s={1.05} a="#ff5a5a" b="#ffffff" />
      <Stall x={1350} y={690} s={0.95} a="#63cbe8" b="#ffffff" />
      <Stall x={2520} y={670} s={1.05} a="#7ac74f" b="#ffffff" />
      {/* balloon cart */}
      <g transform="translate(2980 760)">
        <rect x="-60" y="0" width="120" height="70" rx="10" fill="#c0503a" />
        <circle cx="-38" cy="82" r="20" fill="#5a4632" />
        <circle cx="38" cy="82" r="20" fill="#5a4632" />
        {[["-40", "-150", "#ff5a5a"], ["0", "-185", "#ffd23f"], ["40", "-150", "#63cbe8"], ["18", "-120", "#ff8fd0"]].map(([bx, by, bc], i) => (
          <g key={i}>
            <path d={`M${bx},${Number(by) + 34} Q${Number(bx) / 2},${Number(by) / 2 + 20} 0,0`} stroke="#8a6a4a" strokeWidth="3" fill="none" />
            <ellipse cx={bx} cy={by} rx="26" ry="32" fill={bc} />
          </g>
        ))}
      </g>
      {/* crates by the street edge */}
      <rect x="130" y="840" width="90" height="66" rx="8" fill="#b98a55" />
      <rect x="150" y="784" width="90" height="66" rx="8" fill="#a9784a" />
      <rect x="1560" y="860" width="90" height="66" rx="8" fill="#b98a55" />
    </>
  );
}

// --------------------------------------------------------------------------
// Theme 5 — Twilight Carnival
// --------------------------------------------------------------------------

function FerrisWheel({ x, y, s }: { x: number; y: number; s: number }) {
  const R = 210;
  const cabins = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = (i / 8) * Math.PI * 2;
    return { cx: Math.cos(a) * R, cy: Math.sin(a) * R, c: ["#ff5a5a", "#ffd23f", "#63cbe8", "#ff8fd0"][i % 4] };
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M-14,${R + 130} L0,0 L14,${R + 130}`} fill="none" stroke="#5a5f7a" strokeWidth="22" strokeLinecap="round" />
      <circle r={R} fill="none" stroke="#8f94b8" strokeWidth="14" />
      <circle r={R - 40} fill="none" stroke="#8f94b8" strokeWidth="6" opacity="0.7" />
      {cabins.map((c, i) => (
        <line key={i} x1="0" y1="0" x2={c.cx} y2={c.cy} stroke="#8f94b8" strokeWidth="7" />
      ))}
      <circle r="26" fill="#ffd23f" />
      {cabins.map((c, i) => (
        <g key={i} transform={`translate(${c.cx} ${c.cy})`}>
          <rect x="-26" y="-4" width="52" height="44" rx="14" fill={c.c} />
          <rect x="-26" y="-4" width="52" height="16" rx="8" fill="#ffffff" opacity="0.35" />
        </g>
      ))}
    </g>
  );
}

function Tent({ x, y, s, a, b }: { x: number; y: number; s: number; a: string; b: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${-125 + i * 50},110 L${-100 + i * 50},-40 L${-75 + i * 50},110 Z`} fill={i % 2 ? a : b} />
      ))}
      <path d="M-100,-40 Q0,-105 100,-40 L100,-24 Q0,-88 -100,-24 Z" fill={a} />
      <path d="M0,-70 L0,-120" stroke="#5a5f7a" strokeWidth="6" />
      <path d="M0,-120 L44,-108 L0,-96 Z" fill="#ffd23f" />
      <path d="M-34,110 Q0,30 34,110 Z" fill="#2b2145" />
      <ellipse cx="0" cy="112" rx="150" ry="16" fill="#241c3a" opacity="0.6" />
    </g>
  );
}

function StringLights({ x1, x2, y, sag }: { x1: number; x2: number; y: number; sag: number }) {
  const bulbs: JSX.Element[] = [];
  const n = 12;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const bx = x1 + (x2 - x1) * t;
    const by = y + Math.sin(Math.PI * t) * sag + 12;
    const c = ["#ffd23f", "#ff8fd0", "#63cbe8", "#aef2a0"][i % 4];
    bulbs.push(
      <g key={i}>
        <circle cx={bx} cy={by} r="16" fill={c} opacity="0.28" />
        <circle cx={bx} cy={by} r="8" fill={c} />
      </g>,
    );
  }
  return (
    <g>
      <path d={`M${x1},${y} Q${(x1 + x2) / 2},${y + sag * 2} ${x2},${y}`} stroke="#8f94b8" strokeWidth="4" fill="none" />
      {bulbs}
    </g>
  );
}

function CarnivalBackdrop() {
  return (
    <>
      <defs>
        <linearGradient id="cnv-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241c50" />
          <stop offset="55%" stopColor="#4d3a86" />
          <stop offset="100%" stopColor="#b8628f" />
        </linearGradient>
        <linearGradient id="cnv-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3a6e" />
          <stop offset="100%" stopColor="#332752" />
        </linearGradient>
        <radialGradient id="cnv-moonglow">
          <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff6d8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="3200" height="620" fill="url(#cnv-sky)" />
      {/* stars */}
      {[
        [150, 90, 5], [400, 200, 4], [680, 60, 6], [950, 160, 4], [1180, 90, 5],
        [1420, 220, 4], [1700, 70, 6], [1960, 180, 4], [2200, 100, 5], [2480, 60, 4],
        [2760, 170, 5], [3060, 110, 4], [540, 330, 3], [1300, 340, 3], [2050, 320, 3],
        [2900, 300, 3], [820, 260, 3], [2340, 260, 3],
      ].map(([sx, sy, sr], i) => (
        <circle key={i} cx={sx} cy={sy} r={sr} fill="#fff6d8" opacity={i % 2 ? 0.7 : 1} />
      ))}
      {/* moon */}
      <circle cx="470" cy="150" r="150" fill="url(#cnv-moonglow)" />
      <circle cx="470" cy="150" r="66" fill="#fff6d8" />
      <circle cx="446" cy="132" r="12" fill="#efe0b8" />
      <circle cx="492" cy="168" r="9" fill="#efe0b8" />
      {/* ground */}
      <path d="M0,600 Q800,570 1600,600 Q2400,630 3200,590 L3200,1000 L0,1000 Z" fill="url(#cnv-ground)" />
      <ellipse cx="1600" cy="980" rx="1500" ry="90" fill="#241c3a" opacity="0.5" />
      {/* midway path with light pools */}
      <path d="M300,1000 Q1000,760 1600,780 Q2300,800 2900,1000 Z" fill="#5a4784" opacity="0.6" />
      {[[900, 830], [1600, 840], [2300, 850]].map(([px, py], i) => (
        <ellipse key={i} cx={px} cy={py} rx="150" ry="30" fill="#ffd23f" opacity="0.12" />
      ))}
      <FerrisWheel x={2720} y={330} s={1.05} />
      <Tent x={620} y={620} s={1.15} a="#c0503a" b="#f2e6d0" />
      <Tent x={1420} y={650} s={0.95} a="#4d7fb5" b="#f2e6d0" />
      <StringLights x1={80} x2={1050} y={430} sag={60} />
      <StringLights x1={1050} x2={2080} y={415} sag={70} />
      <StringLights x1={2080} x2={3140} y={430} sag={60} />
      {/* ticket booth */}
      <g transform="translate(1950 690)">
        <rect x="-70" y="-60" width="140" height="150" rx="10" fill="#8f4fa8" />
        <path d="M-86,-56 L0,-110 L86,-56 Z" fill="#ffd23f" />
        <rect x="-44" y="-30" width="88" height="52" rx="8" fill="#fff6d8" />
        <text x="0" y="66" textAnchor="middle" fontSize="34" fontWeight="900" fill="#ffd23f">TICKETS</text>
      </g>
      {/* balloon bunch drifting */}
      <g transform="translate(1150 480)">
        {[["-30", "-40", "#ff5a5a"], ["10", "-70", "#ffd23f"], ["44", "-30", "#63cbe8"]].map(([bx, by, bc], i) => (
          <g key={i}>
            <path d={`M${bx},${Number(by) + 30} Q${Number(bx) / 2},60 0,110`} stroke="#8f94b8" strokeWidth="3" fill="none" />
            <ellipse cx={bx} cy={by} rx="24" ry="30" fill={bc} />
          </g>
        ))}
      </g>
      {/* lantern posts */}
      {[260, 1720, 3020].map((lx, i) => (
        <g key={i} transform={`translate(${lx} 760)`}>
          <rect x="-7" y="-160" width="14" height="180" rx="6" fill="#5a5f7a" />
          <circle cx="0" cy="-170" r="34" fill="#ffd23f" opacity="0.3" />
          <circle cx="0" cy="-170" r="18" fill="#ffd23f" />
        </g>
      ))}
    </>
  );
}

// --------------------------------------------------------------------------

const BACKDROPS: Record<WaldoTheme, () => JSX.Element> = {
  beach: BeachBackdrop,
  garden: GardenBackdrop,
  snow: SnowBackdrop,
  market: MarketBackdrop,
  carnival: CarnivalBackdrop,
};

export function WaldoBackdrop({ theme }: { theme: WaldoTheme }) {
  const Art = BACKDROPS[theme];
  return (
    <svg
      viewBox="0 0 3200 1000"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <Art />
    </svg>
  );
}
