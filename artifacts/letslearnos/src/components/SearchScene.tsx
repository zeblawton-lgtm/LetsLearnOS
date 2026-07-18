// ---------------------------------------------------------------------------
// SearchScene — the pannable Hidden Search picture (/search, ADR-021).
//
// Same interaction contract as WaldoScene (/seek): one-finger drag pans the
// wide 3.2:1 picture, taps are suppressed when the press was really a pan,
// every tappable sprite's hit area is floored at 88px, and there is no
// "wrong" cue — tapping anyone who isn't the target just wiggles them.
//
// Differences from WaldoScene:
//  - Coordinates are logical px on the fixed 3200x1000 canvas (converted to
//    percentages here), not authored percentages.
//  - The scene renders generated entities: backdrop bands, then props/NPCs
//    (vector art from search-props.tsx, pointer-events-none so taps always
//    fall through to creatures), then Pokémon by z-layer/y order.
//  - The ONE target can be partially occluded at higher tiers (ADR-021);
//    occluders only ever cover its lower third. Scenery ignores pointer input,
//    so the target remains tappable without painting above its occluder.
//  - Hint = glide the picture to the target + a shimmer pulse around it.
//    Magnifier (math-hook reward) = the same glide plus a brief zoom-in.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { Star } from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import {
  SEARCH_CANVAS,
  searchPokemonName,
  type SearchPage,
} from "@/content/search";
import { PROP_ART, PROP_ASPECT, NPC_ART, NPC_ASPECT } from "@/content/search-props";
import { SearchBackdrop } from "@/components/SearchBackdrop";

const SCENE_ASPECT = SEARCH_CANVAS.w / SEARCH_CANVAS.h; // 3.2
const TAP_SLOP_PX = 12;

const WIGGLE_KEYFRAMES = { rotate: [0, -10, 10, -8, 8, -4, 0] };
const WIGGLE_TRANSITION = { duration: 0.7, ease: "easeInOut" as const };

const pctX = (x: number) => (x / SEARCH_CANVAS.w) * 100;
const pctY = (y: number) => (y / SEARCH_CANVAS.h) * 100;

interface SearchSceneProps {
  page: SearchPage;
  found: boolean;
  /** Bump to glide-to-target + shimmer (hint). */
  hintNonce: number;
  /** Bump to glide-to-target + zoom (magnifier reward). */
  magnifyNonce: number;
  onTapSprite: (isTarget: boolean) => void;
  className?: string;
}

interface Placed {
  key: string;
  species: number;
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
  z: number;
  isTarget: boolean;
}

export function SearchScene({
  page,
  found,
  hintNonce,
  magnifyNonce,
  onTapSprite,
  className = "",
}: SearchSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const panX = useMotionValue(0);
  const zoom = useMotionValue(1);
  const dragRef = useRef<{ startX: number; startPan: number; dist: number } | null>(null);
  const lastDragDistRef = useRef(0);
  const [wiggleKey, setWiggleKey] = useState<string | null>(null);
  const [shimmer, setShimmer] = useState(false);

  const clampPan = useCallback((value: number) => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return value;
    const min = Math.min(0, container.offsetWidth - inner.offsetWidth);
    return Math.max(min, Math.min(0, value));
  }, []);

  // New page: reset zoom/shimmer and open centered.
  useLayoutEffect(() => {
    panX.stop();
    zoom.stop();
    zoom.set(1);
    setShimmer(false);
    setWiggleKey(null);
    const container = containerRef.current;
    const inner = innerRef.current;
    if (container && inner) {
      panX.set(Math.min(0, (container.offsetWidth - inner.offsetWidth) / 2));
    }
  }, [page.id, panX, zoom]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      panX.stop();
      dragRef.current = { startX: e.clientX, startPan: panX.get(), dist: 0 };
    },
    [panX],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      drag.dist = Math.max(drag.dist, Math.abs(dx));
      panX.set(clampPan(drag.startPan + dx));
    };
    const onUp = () => {
      if (dragRef.current) lastDragDistRef.current = dragRef.current.dist;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panX, clampPan]);

  // Glide the picture so the target's neighborhood is on screen.
  const panToTarget = useCallback(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const centerPx = (page.target.x / SEARCH_CANVAS.w) * inner.offsetWidth;
    const desired = clampPan(container.offsetWidth / 2 - centerPx);
    animate(panX, desired, { type: "spring", stiffness: 110, damping: 22 });
  }, [page, panX, clampPan]);

  // Hint: glide + shimmer pulse (a soft glowing circle around the target
  // zone — generous, it marks the neighborhood rather than the pixel).
  useEffect(() => {
    if (hintNonce === 0) return;
    panToTarget();
    setShimmer(true);
    const timer = window.setTimeout(() => setShimmer(false), 2600);
    return () => window.clearTimeout(timer);
  }, [hintNonce, panToTarget]);

  // Magnifier: glide + a brief gentle zoom centered on the target, then back.
  useEffect(() => {
    if (magnifyNonce === 0) return;
    panToTarget();
    setShimmer(true);
    const zoomIn = animate(zoom, 1.55, { duration: 0.7, ease: "easeInOut" });
    const timer = window.setTimeout(() => {
      animate(zoom, 1, { duration: 0.7, ease: "easeInOut" });
      setShimmer(false);
    }, 2600);
    return () => {
      zoomIn.stop();
      window.clearTimeout(timer);
      zoom.set(1);
    };
  }, [magnifyNonce, panToTarget, zoom]);

  const handleTap = useCallback(
    (p: Placed) => {
      if (lastDragDistRef.current > TAP_SLOP_PX) return; // was a pan
      onTapSprite(p.isTarget);
      if (!p.isTarget || found) {
        setWiggleKey(p.key);
        window.setTimeout(() => setWiggleKey((cur) => (cur === p.key ? null : cur)), 700);
      }
    },
    [onTapSprite, found],
  );

  // Build the render list: creatures (buttons) and scenery (inert), all
  // sorted painter's-order by z-layer then y so overlaps look right.
  const creatures: Placed[] = [
    ...page.entities
      .filter((e) => e.type === "pokemon")
      .map((e, i) => ({
        key: `e${i}`,
        species: Number(e.assetId.split(":")[1]),
        x: e.x, y: e.y, scale: e.scale, flip: e.flip, z: e.zLayer,
        isTarget: false,
      })),
    ...page.decoys.map((d, i) => ({
      key: `d${i}`,
      species: d.species,
      x: d.x, y: d.y, scale: d.scale, flip: d.flip, z: 2,
      isTarget: false,
    })),
    {
      key: "target",
      species: page.target.species,
      x: page.target.x, y: page.target.y, scale: page.target.scale, z: 2,
      isTarget: true,
    },
  ];

  const scenery = page.entities
    .map((e, i) => ({ ...e, key: `s${i}` }))
    .filter((e) => e.type !== "pokemon");

  type Layer =
    | { kind: "creature"; z: number; y: number; c: Placed }
    | { kind: "scenery"; z: number; y: number; s: (typeof scenery)[number] };
  const layers: Layer[] = [
    ...creatures.map((c) => ({ kind: "creature" as const, z: c.z, y: c.y, c })),
    ...scenery.map((s) => ({ kind: "scenery" as const, z: s.zLayer, y: s.y, s })),
  ].sort((a, b) => a.z - b.z || a.y - b.y);

  const renderCreature = (p: Placed) => {
    const isFound = p.isTarget && found;
    return (
      <motion.button
        key={p.key}
        onClick={() => handleTap(p)}
        aria-label={searchPokemonName(p.species)}
        className="absolute flex items-center justify-center"
        style={{
          left: `${pctX(p.x)}%`,
          top: `${pctY(p.y)}%`,
          x: "-50%",
          y: "-50%",
          width: `${pctX(p.scale)}%`,
          minWidth: 88,
          minHeight: 88,
        }}
        animate={
          isFound
            ? { scale: [1, 1.4, 1] }
            : wiggleKey === p.key
              ? WIGGLE_KEYFRAMES
              : { scale: 1, rotate: 0 }
        }
        transition={isFound ? { duration: 0.55, ease: "easeOut" } : WIGGLE_TRANSITION}
      >
        {isFound && (
          <span
            className="absolute inset-0 rounded-full bg-yellow-200/40 ring-8 ring-pokemon-yellow"
            aria-hidden="true"
          />
        )}
        <img
          src={ARTWORK(p.species)}
          onError={onSpriteError}
          alt=""
          draggable={false}
          className="pointer-events-none relative w-full drop-shadow-md"
          style={p.flip ? { transform: "scaleX(-1)" } : undefined}
        />
        {isFound && (
          <span className="absolute -right-1 -top-1" aria-hidden="true">
            <Star size={34} className="text-pokemon-yellow fill-pokemon-yellow drop-shadow" />
          </span>
        )}
      </motion.button>
    );
  };

  const renderScenery = (s: (typeof scenery)[number]) => {
    const name = s.assetId.split(":")[1];
    const Art = s.type === "npc" ? NPC_ART[name] : PROP_ART[name];
    if (!Art) return null;
    const aspect = s.type === "npc" ? NPC_ASPECT : (PROP_ASPECT[name] ?? 1);
    return (
      <div
        key={s.key}
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: `${pctX(s.x)}%`,
          top: `${pctY(s.y)}%`,
          transform: `translate(-50%, -50%)${s.flip ? " scaleX(-1)" : ""}`,
          width: `${pctX(s.scale)}%`,
          aspectRatio: `${1 / aspect}`,
        }}
      >
        <Art />
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      className={`relative overflow-hidden cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{ touchAction: "none" }}
    >
      <motion.div
        ref={innerRef}
        className="relative h-full"
        style={{
          x: panX,
          scale: zoom,
          aspectRatio: String(SCENE_ASPECT),
          transformOrigin: `${pctX(page.target.x)}% ${pctY(page.target.y)}%`,
        }}
      >
        <SearchBackdrop theme={page.theme} />
        {layers.map((l) => (l.kind === "creature" ? renderCreature(l.c) : renderScenery(l.s)))}
        {shimmer && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${pctX(page.target.x)}%`,
              top: `${pctY(page.target.y)}%`,
              width: "16%",
              aspectRatio: "1",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,226,122,0.55) 0%, rgba(255,226,122,0.25) 55%, transparent 72%)",
              zIndex: 20,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0.6, 1, 0], scale: [0.6, 1.15, 0.95, 1.15, 1.3] }}
            transition={{ duration: 2.6, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}
