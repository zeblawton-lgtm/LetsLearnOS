// ---------------------------------------------------------------------------
// Hidden Search prop & NPC registry (ADR-021).
//
// The generation pipeline places these by name (asset_id "prop:crate",
// "npc:vendor", ...); this file is the single source of truth for what each
// name looks like and its aspect ratio (height = width x aspect). Aspects
// MUST stay in sync with scripts/waldo_config.json — the validator computes
// occlusion and on-canvas checks from those numbers.
//
// Style: flat cartoon vectors matching WaldoBackdrop (soft colors, rounded
// shapes, no strokes thinner than 2 so they stay crisp at 4K). All are
// decorative only — SearchScene renders them pointer-events-none so taps
// fall through to the Pokémon underneath.
// ---------------------------------------------------------------------------

import type { FC, ReactElement, ReactNode } from "react";

/** height/width ratio per prop — keep identical to waldo_config.json. */
export const PROP_ASPECT: Record<string, number> = {
  "stall-red": 1.0, "stall-blue": 1.0, fountain: 0.9, bench: 0.5,
  lamppost: 2.4, "tree-round": 1.3, "tree-pine": 1.6, bush: 0.6,
  flowerbed: 0.4, rock: 0.7, crate: 1.0, barrel: 1.2,
  "boat-small": 0.6, "boat-sail": 1.2, "pier-post": 1.8, net: 0.8,
  lighthouse: 2.6, umbrella: 1.1, sandcastle: 0.8, snowman: 1.4,
  tent: 0.9, "balloon-cluster": 1.3, "ferris-wheel": 1.0,
  "train-car": 0.55, "station-clock": 2.2, "gym-sign": 1.2,
};

export const NPC_ASPECT = 1.5;

type Art = FC;

const svg = (aspect: number, children: ReactNode): ReactElement => (
  <svg
    viewBox={`0 0 100 ${Math.round(aspect * 100)}`}
    className="h-full w-full"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// --------------------------------- props -----------------------------------

const Stall = (awning: string, awningDark: string): Art => () =>
  svg(1.0, (
    <>
      <rect x="10" y="42" width="80" height="46" rx="4" fill="#c9924f" />
      <rect x="10" y="42" width="80" height="10" fill="#a9743a" />
      <rect x="6" y="62" width="88" height="8" rx="3" fill="#a9743a" />
      <path d="M2 42 L50 6 L98 42 Z" fill={awning} />
      {[14, 34, 54, 74].map((x) => (
        <path key={x} d={`M${x} 42 L${x + 10} 42 L${x + 12} 27 L${x + 4} 27 Z`} fill={awningDark} />
      ))}
      <circle cx="30" cy="76" r="6" fill="#e74c40" />
      <circle cx="44" cy="76" r="6" fill="#f5a623" />
      <circle cx="58" cy="76" r="6" fill="#52c46a" />
    </>
  ));

const Fountain: Art = () =>
  svg(0.9, (
    <>
      <ellipse cx="50" cy="76" rx="46" ry="13" fill="#9db4c4" />
      <ellipse cx="50" cy="72" rx="38" ry="10" fill="#bfe3ff" />
      <rect x="42" y="34" width="16" height="34" rx="5" fill="#b0c2cf" />
      <ellipse cx="50" cy="34" rx="20" ry="6" fill="#9db4c4" />
      <path d="M50 12 Q42 24 46 32 M50 12 Q58 24 54 32" stroke="#8fd1ff" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="10" r="5" fill="#8fd1ff" />
    </>
  ));

const Bench: Art = () =>
  svg(0.5, (
    <>
      <rect x="4" y="12" width="92" height="10" rx="4" fill="#b3813f" />
      <rect x="4" y="26" width="92" height="9" rx="4" fill="#c9924f" />
      <rect x="10" y="34" width="9" height="14" rx="2" fill="#8f632c" />
      <rect x="81" y="34" width="9" height="14" rx="2" fill="#8f632c" />
    </>
  ));

const Lamppost: Art = () =>
  svg(2.4, (
    <>
      <rect x="45" y="34" width="10" height="192" rx="4" fill="#4b5563" />
      <rect x="28" y="226" width="44" height="12" rx="5" fill="#374151" />
      <circle cx="50" cy="22" r="16" fill="#ffe27a" />
      <circle cx="50" cy="22" r="9" fill="#fff7cc" />
      <rect x="38" y="34" width="24" height="7" rx="3" fill="#374151" />
    </>
  ));

const TreeRound: Art = () =>
  svg(1.3, (
    <>
      <rect x="43" y="86" width="14" height="40" rx="5" fill="#8f632c" />
      <circle cx="50" cy="56" r="42" fill="#4d9e3f" />
      <circle cx="28" cy="68" r="22" fill="#5cb64c" />
      <circle cx="72" cy="66" r="24" fill="#5cb64c" />
      <circle cx="42" cy="40" r="7" fill="#e74c40" />
      <circle cx="64" cy="52" r="7" fill="#e74c40" />
    </>
  ));

const TreePine: Art = () =>
  svg(1.6, (
    <>
      <rect x="44" y="122" width="12" height="36" rx="4" fill="#8f632c" />
      <path d="M50 6 L82 60 L18 60 Z" fill="#2f7d4f" />
      <path d="M50 40 L88 100 L12 100 Z" fill="#37945d" />
      <path d="M50 76 L94 134 L6 134 Z" fill="#43a86b" />
    </>
  ));

const Bush: Art = () =>
  svg(0.6, (
    <>
      <ellipse cx="50" cy="42" rx="46" ry="18" fill="#4d9e3f" />
      <circle cx="26" cy="30" r="18" fill="#5cb64c" />
      <circle cx="54" cy="24" r="20" fill="#52ab44" />
      <circle cx="78" cy="32" r="16" fill="#5cb64c" />
    </>
  ));

const Flowerbed: Art = () =>
  svg(0.4, (
    <>
      <ellipse cx="50" cy="28" rx="48" ry="12" fill="#5cb64c" />
      {[
        [16, "#f77ae0"], [34, "#ffe27a"], [50, "#ff8fc4"],
        [66, "#b68cff"], [84, "#ffb054"],
      ].map(([x, c], i) => (
        <g key={i}>
          <circle cx={x as number} cy={18} r="7" fill={c as string} />
          <circle cx={x as number} cy={18} r="3" fill="#fff7cc" />
        </g>
      ))}
    </>
  ));

const Rock: Art = () =>
  svg(0.7, (
    <>
      <path d="M12 62 Q6 34 30 24 Q48 8 70 20 Q94 28 90 52 Q92 66 76 68 L20 68 Z" fill="#9aa5b1" />
      <path d="M30 24 Q48 8 70 20 L64 34 Q46 26 34 36 Z" fill="#b4bec9" />
    </>
  ));

const Crate: Art = () =>
  svg(1.0, (
    <>
      <rect x="8" y="8" width="84" height="84" rx="5" fill="#c9924f" />
      <rect x="8" y="8" width="84" height="84" rx="5" fill="none" stroke="#a9743a" strokeWidth="7" />
      <path d="M12 12 L88 88 M88 12 L12 88" stroke="#a9743a" strokeWidth="6" />
    </>
  ));

const Barrel: Art = () =>
  svg(1.2, (
    <>
      <path d="M20 12 Q50 2 80 12 Q92 60 80 108 Q50 118 20 108 Q8 60 20 12 Z" fill="#b3813f" />
      <rect x="10" y="30" width="80" height="9" rx="4" fill="#6b4a1f" />
      <rect x="10" y="80" width="80" height="9" rx="4" fill="#6b4a1f" />
    </>
  ));

const BoatSmall: Art = () =>
  svg(0.6, (
    <>
      <path d="M4 24 L96 24 L78 54 Q50 62 22 54 Z" fill="#e74c40" />
      <path d="M4 24 L96 24 L90 34 L10 34 Z" fill="#c0362b" />
      <rect x="44" y="6" width="12" height="18" rx="3" fill="#f5e2a6" />
    </>
  ));

const BoatSail: Art = () =>
  svg(1.2, (
    <>
      <path d="M8 92 L92 92 L76 114 Q50 120 24 114 Z" fill="#3b6ea5" />
      <rect x="47" y="14" width="6" height="80" fill="#8f632c" />
      <path d="M53 16 Q88 44 53 82 Z" fill="#fff" />
      <path d="M45 24 Q20 48 45 78 Z" fill="#ffe27a" />
    </>
  ));

const PierPost: Art = () =>
  svg(1.8, (
    <>
      <rect x="32" y="10" width="36" height="164" rx="10" fill="#8f632c" />
      <ellipse cx="50" cy="12" rx="18" ry="7" fill="#a9743a" />
      <path d="M32 60 h36 M32 110 h36" stroke="#6b4a1f" strokeWidth="6" />
    </>
  ));

const Net: Art = () =>
  svg(0.8, (
    <>
      <circle cx="34" cy="34" r="28" fill="none" stroke="#b3813f" strokeWidth="7" />
      <path d="M14 34 h40 M34 14 v40 M20 20 l28 28 M48 20 L20 48" stroke="#d9c18a" strokeWidth="3" />
      <rect x="56" y="52" width="42" height="9" rx="4" transform="rotate(38 56 52)" fill="#8f632c" />
    </>
  ));

const Lighthouse: Art = () =>
  svg(2.6, (
    <>
      <path d="M32 60 L68 60 L78 244 L22 244 Z" fill="#f2f5f7" />
      <path d="M35 92 L65 92 L67 128 L33 128 Z" fill="#e74c40" />
      <path d="M30 168 L70 168 L72 204 L28 204 Z" fill="#e74c40" />
      <rect x="30" y="34" width="40" height="26" rx="4" fill="#ffe27a" />
      <path d="M26 34 L74 34 L50 10 Z" fill="#c0362b" />
      <rect x="18" y="240" width="64" height="16" rx="6" fill="#9aa5b1" />
    </>
  ));

const Umbrella: Art = () =>
  svg(1.1, (
    <>
      <path d="M50 8 Q94 20 96 52 L4 52 Q6 20 50 8 Z" fill="#e74c40" />
      <path d="M28 52 Q26 24 50 10 Q74 24 72 52 Z" fill="#fff" />
      <rect x="47" y="52" width="6" height="56" rx="3" fill="#8f632c" />
    </>
  ));

const Sandcastle: Art = () =>
  svg(0.8, (
    <>
      <rect x="10" y="40" width="80" height="38" rx="4" fill="#eed08e" />
      <rect x="22" y="16" width="22" height="26" fill="#e6c47c" />
      <rect x="58" y="16" width="22" height="26" fill="#e6c47c" />
      <path d="M22 16 h6 v-6 h4 v6 h6 v-6 h4 v6 M58 16 h6 v-6 h4 v6 h6 v-6 h4 v6" fill="#e6c47c" />
      <path d="M44 78 L44 56 Q50 50 56 56 L56 78 Z" fill="#c9a35c" />
      <path d="M33 6 L45 12 L33 16 Z" fill="#e74c40" />
    </>
  ));

const Snowman: Art = () =>
  svg(1.4, (
    <>
      <circle cx="50" cy="104" r="34" fill="#fff" />
      <circle cx="50" cy="56" r="26" fill="#fff" />
      <circle cx="50" cy="22" r="17" fill="#fff" />
      <circle cx="44" cy="18" r="2.6" fill="#374151" />
      <circle cx="56" cy="18" r="2.6" fill="#374151" />
      <path d="M50 22 L62 26 L50 29 Z" fill="#f5a623" />
      <rect x="34" y="2" width="32" height="6" rx="3" fill="#e74c40" />
      <circle cx="50" cy="50" r="3" fill="#374151" />
      <circle cx="50" cy="62" r="3" fill="#374151" />
    </>
  ));

const Tent: Art = () =>
  svg(0.9, (
    <>
      <path d="M50 8 L96 82 L4 82 Z" fill="#b68cff" />
      <path d="M50 8 L74 82 L26 82 Z" fill="#9260ea" />
      <path d="M50 30 L62 82 L38 82 Z" fill="#4c3575" />
      <rect x="2" y="80" width="96" height="8" rx="4" fill="#7448c8" />
    </>
  ));

const BalloonCluster: Art = () =>
  svg(1.3, (
    <>
      {[
        [30, 26, "#e74c40"], [56, 16, "#ffe27a"], [76, 34, "#4aa8ff"],
        [42, 48, "#52c46a"], [66, 58, "#f77ae0"],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <ellipse cx={x as number} cy={y as number} rx="14" ry="17" fill={c as string} />
          <path d={`M${x} ${(y as number) + 17} Q${(x as number) + 3} ${(y as number) + 40} 50 118`} stroke="#6b7280" strokeWidth="2" fill="none" />
        </g>
      ))}
    </>
  ));

const FerrisWheel: Art = () =>
  svg(1.0, (
    <>
      <circle cx="50" cy="42" r="36" fill="none" stroke="#9aa5b1" strokeWidth="5" />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = 50 + 36 * Math.cos(rad);
        const y = 42 + 36 * Math.sin(rad);
        const colors = ["#e74c40", "#ffe27a", "#4aa8ff", "#52c46a", "#f77ae0", "#ffb054"];
        return (
          <g key={deg}>
            <line x1="50" y1="42" x2={x} y2={y} stroke="#9aa5b1" strokeWidth="3" />
            <rect x={x - 7} y={y - 4} width="14" height="12" rx="4" fill={colors[deg / 60]} />
          </g>
        );
      })}
      <circle cx="50" cy="42" r="6" fill="#4b5563" />
      <path d="M50 46 L30 96 L70 96 Z" fill="#6b7280" />
    </>
  ));

const TrainCar: Art = () =>
  svg(0.55, (
    <>
      <rect x="2" y="8" width="96" height="34" rx="8" fill="#e74c40" />
      <rect x="2" y="26" width="96" height="10" fill="#c0362b" />
      {[12, 40, 68].map((x) => (
        <rect key={x} x={x} y="14" width="20" height="12" rx="3" fill="#bfe3ff" />
      ))}
      <circle cx="20" cy="48" r="7" fill="#374151" />
      <circle cx="80" cy="48" r="7" fill="#374151" />
    </>
  ));

const StationClock: Art = () =>
  svg(2.2, (
    <>
      <rect x="45" y="52" width="10" height="156" rx="4" fill="#4b5563" />
      <rect x="30" y="208" width="40" height="10" rx="4" fill="#374151" />
      <circle cx="50" cy="30" r="27" fill="#374151" />
      <circle cx="50" cy="30" r="21" fill="#fff" />
      <path d="M50 30 L50 16 M50 30 L60 34" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
    </>
  ));

const GymSign: Art = () =>
  svg(1.2, (
    <>
      <rect x="12" y="8" width="76" height="56" rx="10" fill="#f2f5f7" />
      <rect x="12" y="8" width="76" height="56" rx="10" fill="none" stroke="#e74c40" strokeWidth="6" />
      <circle cx="50" cy="36" r="16" fill="#e74c40" />
      <rect x="34" y="33" width="32" height="6" fill="#f2f5f7" />
      <circle cx="50" cy="36" r="6" fill="#fff" stroke="#374151" strokeWidth="3" />
      <rect x="24" y="64" width="8" height="52" fill="#8f632c" />
      <rect x="68" y="64" width="8" height="52" fill="#8f632c" />
    </>
  ));

// --------------------------------- NPCs ------------------------------------
// Friendly round townspeople; factory keeps them visually consistent while
// hats/outfits vary. All share NPC_ASPECT (1.5).

function villager(skin: string, shirt: string, pants: string, hat?: string): Art {
  return () =>
    svg(NPC_ASPECT, (
      <>
        <circle cx="50" cy="34" r="24" fill={skin} />
        <circle cx="42" cy="32" r="3" fill="#374151" />
        <circle cx="58" cy="32" r="3" fill="#374151" />
        <path d="M42 42 Q50 49 58 42" stroke="#374151" strokeWidth="3" fill="none" strokeLinecap="round" />
        {hat && <path d={`M24 22 Q50 ${hat === "#ffe27a" ? -8 : 0} 76 22 L76 28 L24 28 Z`} fill={hat} />}
        <path d="M28 62 Q50 52 72 62 L76 108 L24 108 Z" fill={shirt} />
        <rect x="30" y="106" width="16" height="32" rx="6" fill={pants} />
        <rect x="54" y="106" width="16" height="32" rx="6" fill={pants} />
        <ellipse cx="38" cy="142" rx="11" ry="6" fill="#6b4a1f" />
        <ellipse cx="62" cy="142" rx="11" ry="6" fill="#6b4a1f" />
      </>
    ));
}

export const NPC_ART: Record<string, Art> = {
  "villager-a": villager("#f6c9a0", "#4aa8ff", "#3b5b8f"),
  "villager-b": villager("#8a5a3b", "#52c46a", "#4b5563"),
  "villager-c": villager("#f6c9a0", "#f77ae0", "#6b4a1f", "#ffe27a"),
  "villager-d": villager("#c98a5b", "#ffb054", "#374151"),
  "villager-e": villager("#f0b98d", "#b68cff", "#4c3575", "#e74c40"),
  "villager-f": villager("#8a5a3b", "#ffe27a", "#3b5b8f"),
  vendor: villager("#f0b98d", "#e74c40", "#6b4a1f", "#f2f5f7"),
  fisher: villager("#c98a5b", "#37945d", "#2f4a6b", "#ffe27a"),
  conductor: villager("#f6c9a0", "#374151", "#1f2937", "#4b5563"),
  trainer: villager("#f0b98d", "#e74c40", "#374151", "#e74c40"),
};

export const PROP_ART: Record<string, Art> = {
  "stall-red": Stall("#e74c40", "#f2f5f7"),
  "stall-blue": Stall("#4aa8ff", "#f2f5f7"),
  fountain: Fountain,
  bench: Bench,
  lamppost: Lamppost,
  "tree-round": TreeRound,
  "tree-pine": TreePine,
  bush: Bush,
  flowerbed: Flowerbed,
  rock: Rock,
  crate: Crate,
  barrel: Barrel,
  "boat-small": BoatSmall,
  "boat-sail": BoatSail,
  "pier-post": PierPost,
  net: Net,
  lighthouse: Lighthouse,
  umbrella: Umbrella,
  sandcastle: Sandcastle,
  snowman: Snowman,
  tent: Tent,
  "balloon-cluster": BalloonCluster,
  "ferris-wheel": FerrisWheel,
  "train-car": TrainCar,
  "station-clock": StationClock,
  "gym-sign": GymSign,
};
