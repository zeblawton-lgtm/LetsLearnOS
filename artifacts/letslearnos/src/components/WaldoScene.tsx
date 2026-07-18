// ---------------------------------------------------------------------------
// WaldoScene — the pannable "Where's Waldo" picture for /seek (ADR-020).
//
// Renders one scene as a wide (3.2:1) box that is taller than it is
// scrollable: the box height fills the container and its width overflows,
// so the child drags left/right with one finger to search the whole
// picture. The WaldoBackdrop SVG and every placed Pokémon share the same
// percentage coordinate space, so art and sprites always line up.
//
// Interaction rules (positive feedback only):
//   - drag  = pan (a tap that moved more than TAP_SLOP px is a pan, not a tap)
//   - tap a target  -> onTapPokemon(id); the page decides found/celebration
//   - tap a decoy   -> onTapPokemon(id); page plays a tap sound, and the
//                      sprite does a friendly wiggle here — never a "wrong"
//   - hintId set    -> the picture pans to that Pokémon and it wiggles
//
// Targets render AFTER decoys so they always sit on top of the crowd and
// stay tappable even where sprites overlap. Every sprite's hit area is
// floored at 88x88 px regardless of its visual size (GOAL touch rule).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { Star } from "lucide-react";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import { pokemonName, type WaldoPokemon, type WaldoScene as WaldoSceneData } from "@/content/waldo-scenes";
import { WaldoBackdrop } from "@/components/WaldoBackdrop";

// Scene box width : height. Must match WaldoBackdrop's 3200x1000 viewBox.
const SCENE_ASPECT = 3.2;

// A press that travels farther than this is a pan, not a tap.
const TAP_SLOP_PX = 12;

const WIGGLE_KEYFRAMES = { rotate: [0, -10, 10, -8, 8, -4, 0] };
const WIGGLE_TRANSITION = { duration: 0.7, ease: "easeInOut" as const };

interface WaldoSceneProps {
  scene: WaldoSceneData;
  /** ids the child is currently asked to find (3yo plays a trimmed list). */
  activeTargetIds: ReadonlySet<number>;
  found: ReadonlySet<number>;
  justFoundId: number | null;
  hintId: number | null;
  onTapPokemon: (id: number) => void;
  className?: string;
}

export function WaldoScene({
  scene,
  activeTargetIds,
  found,
  justFoundId,
  hintId,
  onTapPokemon,
  className = "",
}: WaldoSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Pan offset in px (<= 0). A motion value so 60fps dragging never re-renders
  // the ~22 sprite buttons.
  const panX = useMotionValue(0);
  const dragRef = useRef<{ startX: number; startPan: number; dist: number } | null>(null);
  const lastDragDistRef = useRef(0);

  // Decoy-tap wiggle is purely cosmetic, so it lives here rather than in the
  // page's session state.
  const [wiggleId, setWiggleId] = useState<number | null>(null);

  const clampPan = useCallback((value: number) => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return value;
    const min = Math.min(0, container.offsetWidth - inner.offsetWidth);
    return Math.max(min, Math.min(0, value));
  }, []);

  // New scene: cut any hint animation and open centered on the picture.
  useLayoutEffect(() => {
    panX.stop();
    setWiggleId(null);
    const container = containerRef.current;
    const inner = innerRef.current;
    if (container && inner) {
      panX.set(Math.min(0, (container.offsetWidth - inner.offsetWidth) / 2));
    }
  }, [scene.id, panX]);

  // One-finger pan. No pointer capture — moves/ups are tracked on window so
  // the sprite buttons underneath still get their click (suppressed in
  // handleTap when the press was really a pan).
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

  // Hint: glide the picture over so the hinted Pokémon is on screen (it also
  // wiggles below). Without the pan, a hint about an off-screen Pokémon
  // would look like the button did nothing.
  useEffect(() => {
    if (hintId == null) return;
    const container = containerRef.current;
    const inner = innerRef.current;
    const target = scene.pokemon.find((p) => p.id === hintId);
    if (!container || !inner || !target) return;
    const centerPx = (target.xPct / 100) * inner.offsetWidth;
    const desired = clampPan(container.offsetWidth / 2 - centerPx);
    const controls = animate(panX, desired, { type: "spring", stiffness: 110, damping: 22 });
    return () => controls.stop();
  }, [hintId, scene, panX, clampPan]);

  const handleTap = useCallback(
    (p: WaldoPokemon) => {
      if (lastDragDistRef.current > TAP_SLOP_PX) return; // was a pan
      onTapPokemon(p.id);
      const isActiveTarget = activeTargetIds.has(p.id) && !found.has(p.id);
      if (!isActiveTarget) {
        setWiggleId(p.id);
        window.setTimeout(() => setWiggleId((cur) => (cur === p.id ? null : cur)), 700);
      }
    },
    [onTapPokemon, activeTargetIds, found],
  );

  const renderSprite = (p: WaldoPokemon) => {
    const isFound = found.has(p.id);
    const isWiggling = wiggleId === p.id || hintId === p.id;
    const isJustFound = justFoundId === p.id;
    return (
      <motion.button
        key={p.id}
        onClick={() => handleTap(p)}
        aria-label={pokemonName(p.id)}
        className="absolute flex items-center justify-center"
        style={{
          left: `${p.xPct}%`,
          top: `${p.yPct}%`,
          x: "-50%",
          y: "-50%",
          width: `${p.sizePct}%`,
          minWidth: 88,
          minHeight: 88,
        }}
        animate={isJustFound ? { scale: [1, 1.4, 1] } : isWiggling ? WIGGLE_KEYFRAMES : { scale: 1, rotate: 0 }}
        transition={isJustFound ? { duration: 0.55, ease: "easeOut" } : WIGGLE_TRANSITION}
      >
        {isFound && (
          <span className="absolute inset-0 rounded-full bg-yellow-200/40 ring-8 ring-pokemon-yellow" aria-hidden="true" />
        )}
        <img
          src={ARTWORK(p.id)}
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

  const decoys = scene.pokemon.filter((p) => !p.target);
  const targets = scene.pokemon.filter((p) => p.target);

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
        style={{ x: panX, aspectRatio: String(SCENE_ASPECT) }}
      >
        <WaldoBackdrop theme={scene.theme} />
        {decoys.map(renderSprite)}
        {targets.map(renderSprite)}
      </motion.div>
    </div>
  );
}
