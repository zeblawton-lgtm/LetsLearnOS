// ---------------------------------------------------------------------------
// SearchBackdrop — theme backgrounds for Hidden Search (/search, ADR-021).
//
// One wide SVG (viewBox 0 0 3200 1000, the module's logical canvas) per
// theme, drawn in the same flat-cartoon style as WaldoBackdrop but lighter
// on detail: the generated prop entities (stalls, boats, trees...) supply
// the mid-scene furniture, so the backdrop only paints the world's bands —
// sky/water/ground exactly as scripts/waldo_config.json declares them, so
// creatures always stand on the right surface.
// ---------------------------------------------------------------------------

import type { ReactElement } from "react";
import type { SearchTheme } from "@/content/search";

function Sun({ cx = 2900, cy = 130 }: { cx?: number; cy?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="85" fill="#ffe27a" />
      <circle cx={cx} cy={cy} r="60" fill="#fff3b8" />
    </g>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff" opacity="0.9">
      <ellipse cx="0" cy="0" rx="110" ry="38" />
      <circle cx="-45" cy="-22" r="40" />
      <circle cx="18" cy="-30" r="48" />
    </g>
  );
}

/** Soft scalloped tree line used by forest/meadow horizons. */
function TreeLine({ y, fill }: { y: number; fill: string }) {
  const bumps = Array.from({ length: 16 }, (_, i) => {
    const x = i * 200;
    return `Q ${x + 100} ${y - 90} ${x + 200} ${y}`;
  }).join(" ");
  return <path d={`M0 ${y} ${bumps} L3200 1000 L0 1000 Z`} fill={fill} />;
}

function Buildings({ y, fills }: { y: number; fills: string[] }) {
  const widths = [260, 180, 320, 220, 300, 200, 280, 240, 340, 200, 260, 200];
  let x = -40;
  return (
    <g>
      {widths.map((w, i) => {
        const h = 120 + ((i * 67) % 160);
        const el = (
          <g key={i}>
            <rect x={x} y={y - h} width={w} height={h + 40} rx="10" fill={fills[i % fills.length]} />
            {Array.from({ length: 3 }, (_, wi) => (
              <rect key={wi} x={x + 30 + wi * (w / 3.4)} y={y - h + 30} width={w / 6} height={36} rx="6" fill="#fff7cc" opacity="0.85" />
            ))}
          </g>
        );
        x += w + 30;
        return el;
      })}
    </g>
  );
}

function Snowflakes() {
  return (
    <g fill="#ffffff" opacity="0.9">
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 271 + 90) % 3200} cy={((i * 173 + 40) % 900) + 30} r={i % 3 === 0 ? 9 : 6} />
      ))}
    </g>
  );
}

function Stars() {
  return (
    <g fill="#fff7cc">
      {Array.from({ length: 34 }, (_, i) => (
        <circle key={i} cx={(i * 313 + 120) % 3200} cy={(i * 97 + 25) % 330} r={i % 4 === 0 ? 6 : 3.5} opacity={0.5 + (i % 3) * 0.25} />
      ))}
    </g>
  );
}

const THEMES: Record<SearchTheme, () => ReactElement> = {
  // sky 0-280, ground 280-1000
  "city-street": () => (
    <>
      <rect width="3200" height="320" fill="#8ed4ff" />
      <Sun />
      <Cloud x={500} y={130} /> <Cloud x={1900} y={90} s={0.8} />
      <Buildings y={300} fills={["#f2b8a0", "#a8c8ee", "#f5d9a0", "#b8e0b0", "#d9b8ee"]} />
      <rect y="280" width="3200" height="720" fill="#cfd6dd" />
      <rect y="560" width="3200" height="220" fill="#9aa5b1" />
      <g fill="#f2f5f7">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 340 + 60} y="655" width="150" height="26" rx="13" />
        ))}
      </g>
      <rect y="770" width="3200" height="16" fill="#b4bec9" />
    </>
  ),
  // sky (dusk) 0-460, ground 460-1000
  festival: () => (
    <>
      <rect width="3200" height="520" fill="#4c3575" />
      <rect width="3200" height="260" fill="#3b2a5e" />
      <Stars />
      <circle cx="2850" cy="150" r="70" fill="#fff3b8" />
      <path d="M0 470 Q400 380 800 462 T1600 458 T2400 462 T3200 456 L3200 520 L0 520 Z" fill="#5d4390" />
      {/* string lights swooping across the dusk */}
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <path d={`M0 ${180 + row * 110} Q800 ${290 + row * 110} 1600 ${185 + row * 110} T3200 ${190 + row * 110}`} stroke="#2c1e4a" strokeWidth="6" fill="none" />
          {Array.from({ length: 16 }, (_, i) => {
            const colors = ["#ffe27a", "#ff8fc4", "#8fd1ff", "#a5f3b4"];
            return <circle key={i} cx={i * 210 + 80} cy={222 + row * 110 + (i % 2) * 28} r="13" fill={colors[i % 4]} />;
          })}
        </g>
      ))}
      <rect y="460" width="3200" height="540" fill="#3f6b3f" />
      <ellipse cx="1600" cy="1000" rx="1900" ry="330" fill="#4a7a4a" />
    </>
  ),
  // sky 0-300, ground 300-1000
  market: () => (
    <>
      <rect width="3200" height="340" fill="#8ed4ff" />
      <Sun cx={350} />
      <Cloud x={1200} y={110} /> <Cloud x={2500} y={150} s={0.75} />
      <Buildings y={320} fills={["#f5d9a0", "#f2b8a0", "#b8e0b0", "#a8c8ee"]} />
      <rect y="300" width="3200" height="700" fill="#e3d2b4" />
      <g fill="#d9c6a8">
        {Array.from({ length: 60 }, (_, i) => (
          <ellipse key={i} cx={(i * 260 + (i % 2) * 130) % 3200} cy={380 + Math.floor(i / 12) * 130} rx="70" ry="24" />
        ))}
      </g>
    </>
  ),
  // sky 0-320, water 320-520, sand 520-1000
  beach: () => (
    <>
      <rect width="3200" height="330" fill="#8ed4ff" />
      <Sun />
      <Cloud x={700} y={120} /> <Cloud x={2100} y={80} s={0.85} />
      <rect y="320" width="3200" height="210" fill="#4fc6f0" />
      <path d="M0 330 Q400 315 800 330 T1600 330 T2400 330 T3200 330" stroke="#8fe0ff" strokeWidth="10" fill="none" />
      {[0, 1].map((r) => (
        <g key={r} stroke="#bdeaf5" strokeWidth="8" fill="none" opacity="0.8">
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${i * 420 + r * 200} ${400 + r * 70} q 60 -22 120 0`} />
          ))}
        </g>
      ))}
      <path d="M0 540 Q800 505 1600 528 T3200 515 L3200 1000 L0 1000 Z" fill="#f5e2a6" />
      <ellipse cx="600" cy="850" rx="180" ry="30" fill="#eed08e" />
      <ellipse cx="2400" cy="760" rx="220" ry="34" fill="#eed08e" />
    </>
  ),
  // sky 0-260, ground 260-1000
  forest: () => (
    <>
      <rect width="3200" height="300" fill="#bfe8ff" />
      <Sun cx={1600} cy={100} />
      <TreeLine y={290} fill="#2f7d4f" />
      <TreeLine y={360} fill="#37945d" />
      <rect y="380" width="3200" height="620" fill="#5cb64c" />
      <ellipse cx="900" cy="1000" rx="1100" ry="260" fill="#52ab44" />
      <ellipse cx="2600" cy="980" rx="900" ry="220" fill="#67c257" />
      <path d="M1350 420 Q1600 480 1500 700 Q1450 880 1600 1000 L1750 1000 Q1620 860 1670 700 Q1730 500 1500 420 Z" fill="#d9c6a8" opacity="0.7" />
    </>
  ),
  // wall 0-220, floor 220-1000
  gym: () => (
    <>
      <rect width="3200" height="260" fill="#f0e6d8" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${400 + i * 800} 0 L${520 + i * 800} 0 L${460 + i * 800} 170 Z`} fill={["#e74c40", "#4aa8ff", "#ffe27a", "#52c46a"][i]} />
      ))}
      <rect y="220" width="3200" height="780" fill="#d9b57c" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={300 + i * 100} width="3200" height="7" fill="#c9a35c" />
      ))}
      <circle cx="1600" cy="640" r="270" fill="none" stroke="#e74c40" strokeWidth="16" opacity="0.5" />
      <line x1="1330" y1="640" x2="1870" y2="640" stroke="#e74c40" strokeWidth="12" opacity="0.5" />
    </>
  ),
  // sky 0-300, water 300-620, pier 620-1000
  harbor: () => (
    <>
      <rect width="3200" height="320" fill="#8ed4ff" />
      <Sun cx={420} />
      <Cloud x={1500} y={120} /> <Cloud x={2700} y={90} s={0.8} />
      <rect y="300" width="3200" height="330" fill="#3b83c4" />
      <g stroke="#6fa8d8" strokeWidth="9" fill="none" opacity="0.85">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${i * 340 + 40} ${370 + (i % 3) * 80} q 70 -24 140 0`} />
        ))}
      </g>
      <rect y="620" width="3200" height="380" fill="#c9924f" />
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} y={690 + i * 70} width="3200" height="9" fill="#a9743a" />
      ))}
    </>
  ),
  // sky 0-280, platform 280-1000
  "train-station": () => (
    <>
      <rect width="3200" height="320" fill="#8ed4ff" />
      <Sun cx={2950} />
      <Cloud x={800} y={110} s={0.9} />
      <rect y="180" width="3200" height="130" fill="#c96f5a" />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={(i % 20) * 165 + (Math.floor(i / 20) % 2) * 80} y={192 + Math.floor(i / 20) * 60} width="140" height="44" rx="4" fill="#b85a46" />
      ))}
      <rect y="280" width="3200" height="720" fill="#cbb79a" />
      <rect y="840" width="3200" height="60" fill="#8a7a60" />
      <rect y="880" width="3200" height="120" fill="#6f6350" />
      <g fill="#4b5563">
        <rect y="905" width="3200" height="14" />
        <rect y="955" width="3200" height="14" />
      </g>
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={i * 210} y="895" width="90" height="90" fill="#8f632c" />
      ))}
      <rect y="820" width="3200" height="26" rx="4" fill="#ffe27a" />
    </>
  ),
  // sky 0-340, snow 340-1000
  snowfield: () => (
    <>
      <rect width="3200" height="380" fill="#dceefc" />
      <circle cx="2850" cy="140" r="75" fill="#fff7d6" />
      <path d="M0 380 L500 130 L900 380 Z" fill="#b8d4ea" />
      <path d="M700 380 L1250 90 L1800 380 Z" fill="#cadff0" />
      <path d="M1180 240 L1250 90 L1330 245 Z" fill="#ffffff" />
      <path d="M2100 380 L2600 160 L3200 380 Z" fill="#b8d4ea" />
      <rect y="340" width="3200" height="660" fill="#f4f9ff" />
      <ellipse cx="1000" cy="1000" rx="1300" ry="300" fill="#ffffff" />
      <ellipse cx="2700" cy="950" rx="900" ry="240" fill="#e8f2fc" />
      <Snowflakes />
    </>
  ),
  // sky 0-300, meadow 300-1000
  meadow: () => (
    <>
      <rect width="3200" height="340" fill="#8ed4ff" />
      <Sun cx={2900} />
      <Cloud x={600} y={110} /> <Cloud x={1700} y={70} s={0.75} /> <Cloud x={2600} y={160} s={0.6} />
      <path d="M0 340 Q800 240 1600 330 T3200 320 L3200 1000 L0 1000 Z" fill="#7ac95e" />
      <ellipse cx="700" cy="1000" rx="1100" ry="300" fill="#6fbf52" />
      <ellipse cx="2500" cy="1030" rx="1200" ry="330" fill="#86d46a" />
      <g>
        {Array.from({ length: 26 }, (_, i) => {
          const colors = ["#f77ae0", "#ffe27a", "#ff8fc4", "#b68cff", "#ffffff"];
          const x = (i * 347 + 130) % 3200;
          const y = 430 + ((i * 211) % 520);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="17" fill={colors[i % 5]} />
              <circle cx={x} cy={y} r="7" fill="#fff7cc" />
            </g>
          );
        })}
      </g>
    </>
  ),
};

export function SearchBackdrop({ theme }: { theme: SearchTheme }) {
  const Theme = THEMES[theme];
  return (
    <svg
      viewBox="0 0 3200 1000"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <Theme />
    </svg>
  );
}
