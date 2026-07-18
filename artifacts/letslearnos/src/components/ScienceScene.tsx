// ---------------------------------------------------------------------------
// Science 3D Lab renderer (WebGL / three.js) — the Science-sized sibling of
// SolarSystemScene/EarthScene, rebuilt per ADR-017. One persistent scene
// holds all four stations side by side (fire, water, wind, plant); the
// camera eases to whichever is active while every station keeps quietly
// animating in the background (the campfire keeps burning at its current
// health, the windmill keeps decaying its spin, the plant keeps easing its
// growth springs) — same "the rest of the system keeps going" convention as
// SolarSystemScene's planets/EarthScene's spin.
//
// Lifecycle discipline copied wholesale from EarthScene: capped device pixel
// ratio, ResizeObserver-driven resize (writes CSS size, not just the pixel
// buffer — see the resize comment), a single mount effect that never
// rebuilds, webglcontextlost handling with a narrated fallback, and full
// geometry/material/texture disposal + forceContextLoss on unmount
// (ADR-014). Unlike Earth/SolarSystem, a single pointer drag here means "aim
// the tool" (hose/sand/watering-can/wind) rather than orbit the camera — see
// the pointer section below.
//
// Physics are simple custom particle/spring systems (ParticlePool +
// springTo from lib/science-particles), no physics-engine dependency, tuned
// to stay well under the build brief's ~2,500-3,000 live-point budget even
// with every station's pools allocated (see the pool sizing comment above
// the pool constructors).
// ---------------------------------------------------------------------------
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import type { FireTool, StationId } from "@/content/science";
import { ParticlePool, springTo } from "@/lib/science-particles";
import { createGlowTexture, createStarSpriteTexture } from "@/lib/space-textures";

export type ScienceEvent =
  | { type: "fire-midway" }
  | { type: "fire-out" }
  | { type: "water-midway" }
  | { type: "water-full" }
  | { type: "wind-building" }
  | { type: "wind-complete" }
  | { type: "plant-sprout" }
  | { type: "plant-growing" }
  | { type: "plant-complete" };

export interface ScienceHandle {
  /** Resets whichever station is currently active back to its start state
   *  (new campfire, empty basin, still windmill, fresh seed). */
  resetActiveStation: () => void;
}

interface ScienceSceneProps {
  activeStation: StationId;
  /** Which tool the child is holding at the Fire station; null = none picked yet. */
  fireTool: FireTool | null;
  /** Plant station: has the child tapped "Bring Out the Sun"? */
  sunOut: boolean;
  /** Fired at physics milestones — parent owns playTap/TTS so every station
   *  narrates exactly once per milestone (same discipline as onSelectRef in
   *  EarthScene/SolarSystemScene). */
  onEvent: (event: ScienceEvent) => void;
  onError?: (message: string) => void;
  className?: string;
}

// --- Station layout: one wide scene, four dioramas along X --------------
const STATION_X: Record<StationId, number> = {
  fire: -9,
  water: -3,
  wind: 3,
  plant: 9,
};
const STATION_BOUNDS: Record<StationId, { x: [number, number]; z: [number, number] }> = {
  fire: { x: [-10.4, -7.6], z: [-2.2, 2.2] },
  water: { x: [-4.4, -1.6], z: [-2.2, 2.2] },
  wind: { x: [1.6, 4.4], z: [-2.2, 2.2] },
  plant: { x: [7.6, 10.4], z: [-2.2, 2.2] },
};
const LEAF_COLORS = ["#7fbf5a", "#a8d86a", "#f2b6d6", "#ffd76a", "#e8895f"];

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const anyObj = obj as unknown as {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
      isSprite?: boolean;
    };
    if (!anyObj.isSprite) anyObj.geometry?.dispose();
    const materials = Array.isArray(anyObj.material)
      ? anyObj.material
      : anyObj.material
        ? [anyObj.material]
        : [];
    materials.forEach((material) => {
      const withMap = material as unknown as { map?: THREE.Texture | null };
      withMap.map?.dispose();
      material.dispose();
    });
  });
}

// Runtime canvas-2D ground texture (offline, no bundled imagery — same
// approach as space-textures.ts) with a tinted patch under each station so
// the diorama reads as four distinct little worlds on one shared field.
function makeGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grass = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grass.addColorStop(0, "#7cc36a");
  grass.addColorStop(1, "#5da250");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3, 3);
  }

  const patches: { x: number; color: string; r: number }[] = [
    { x: STATION_X.fire, color: "#8b7156", r: 130 },
    { x: STATION_X.water, color: "#9aa2a8", r: 120 },
    { x: STATION_X.wind, color: "#79b967", r: 120 },
    { x: STATION_X.plant, color: "#7a5a3d", r: 130 },
  ];
  patches.forEach(({ x, color, r }) => {
    const px = ((x + 17) / 34) * canvas.width;
    const py = canvas.height / 2;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export const ScienceScene = forwardRef<ScienceHandle, ScienceSceneProps>(
  function ScienceScene({ activeStation, fireTool, sunOut, onEvent, onError, className }, ref) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const activeStationRef = useRef(activeStation);
    const fireToolRef = useRef(fireTool);
    const sunOutRef = useRef(sunOut);
    const onEventRef = useRef(onEvent);
    const onErrorRef = useRef(onError);
    const resetHandlersRef = useRef<Partial<Record<StationId, () => void>>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      activeStationRef.current = activeStation;
    }, [activeStation]);
    useEffect(() => {
      fireToolRef.current = fireTool;
    }, [fireTool]);
    useEffect(() => {
      sunOutRef.current = sunOut;
    }, [sunOut]);
    useEffect(() => {
      onEventRef.current = onEvent;
    }, [onEvent]);
    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    useImperativeHandle(
      ref,
      () => ({
        resetActiveStation: () => {
          resetHandlersRef.current[activeStationRef.current]?.();
        },
      }),
      [],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; scene lives for the component's lifetime
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#bfe3ff");
      scene.fog = new THREE.Fog("#bfe3ff", 18, 42);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        setError(null);
      } catch (err) {
        console.error("Unable to start the science scene.", err);
        const message = "This device could not start the 3D lab.";
        setError(message);
        onErrorRef.current?.(message);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.touchAction = "none";
      mount.appendChild(renderer.domElement);

      // --- Lighting ---------------------------------------------------------
      scene.add(new THREE.HemisphereLight("#eaf6ff", "#3a4326", 0.9));
      const keyLight = new THREE.DirectionalLight("#fff6da", 1.5);
      keyLight.position.set(6, 10, 6);
      scene.add(keyLight);

      // --- Ground + soft clouds ----------------------------------------------
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 12),
        new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95 }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      const cloudTexture = createGlowTexture("#ffffff");
      [
        [-12, 7, -6],
        [-4, 8.2, -8],
        [5, 7.4, -5],
        [12, 6.6, -7.5],
        [0, 9, -9],
      ].forEach(([x, y, z], i) => {
        const material = new THREE.SpriteMaterial({
          map: cloudTexture,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        sprite.scale.set(6 + i, 3 + i * 0.35, 1);
        scene.add(sprite);
      });

      // --- Shared particle texture + pools -------------------------------
      // Eight pools cover every station's effects (see the file header for
      // the budget rationale); "droplet" is deliberately shared across the
      // fire hose, the water station's pour, and the plant's watering can —
      // all three are just "water falling from a spout toward an aim point"
      // in world space, so one pool serves all of them.
      const dotTexture = createStarSpriteTexture();
      const flamePool = new ParticlePool({ max: 420, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -0.7, drag: 0.35, growPortion: 0.18 });
      const sparkPool = new ParticlePool({ max: 90, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -0.6, drag: 0.25, growPortion: 0.1 });
      const smokePool = new ParticlePool({ max: 140, texture: dotTexture, blending: THREE.NormalBlending, gravity: 0.35, drag: 0.5, growPortion: 0.4 });
      const burstPool = new ParticlePool({ max: 260, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -1.8, drag: 0.35, growPortion: 0.12 });
      const dustPool = new ParticlePool({ max: 120, texture: dotTexture, blending: THREE.NormalBlending, gravity: -1.1, drag: 0.55, growPortion: 0.2 });
      const grainPool = new ParticlePool({ max: 150, texture: dotTexture, blending: THREE.NormalBlending, gravity: -3.4, drag: 0.15, growPortion: 0.1 });
      const dropletPool = new ParticlePool({ max: 420, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -3.6, drag: 0.1, growPortion: 0.1 });
      const leafPool = new ParticlePool({ max: 220, texture: dotTexture, blending: THREE.NormalBlending, gravity: -0.15, drag: 0.15, growPortion: 0.15 });
      const pools = [flamePool, sparkPool, smokePool, burstPool, dustPool, grainPool, dropletPool, leafPool];
      pools.forEach((pool) => scene.add(pool.points));

      // =====================================================================
      // FIRE station
      // =====================================================================
      const fireGroup = new THREE.Group();
      fireGroup.position.set(STATION_X.fire, 0, 0);
      scene.add(fireGroup);

      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.22, 0),
          new THREE.MeshStandardMaterial({ color: "#8a8a86", roughness: 0.9 }),
        );
        rock.position.set(Math.cos(angle) * 1.0, 0.12, Math.sin(angle) * 1.0);
        fireGroup.add(rock);
      }
      const logMaterial = new THREE.MeshStandardMaterial({ color: "#6b4a30", roughness: 0.85 });
      const logGeometry = new THREE.CylinderGeometry(0.11, 0.11, 1.3, 10);
      const logA = new THREE.Mesh(logGeometry, logMaterial);
      logA.rotation.z = Math.PI / 2;
      logA.rotation.y = 0.5;
      logA.position.y = 0.14;
      fireGroup.add(logA);
      const logB = new THREE.Mesh(logGeometry, logMaterial);
      logB.rotation.z = Math.PI / 2;
      logB.rotation.y = -0.5;
      logB.position.y = 0.14;
      fireGroup.add(logB);

      const sandMound = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 20, 12),
        new THREE.MeshStandardMaterial({ color: "#d8c08a", roughness: 1 }),
      );
      sandMound.scale.setScalar(0.001);
      sandMound.position.y = 0.05;
      fireGroup.add(sandMound);

      const hoseToolGroup = new THREE.Group();
      const hoseBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10),
        new THREE.MeshStandardMaterial({ color: "#3f7fb0" }),
      );
      const hoseTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.26, 10),
        new THREE.MeshStandardMaterial({ color: "#274d66" }),
      );
      hoseTip.position.y = -0.38;
      hoseTip.rotation.x = Math.PI;
      hoseToolGroup.add(hoseBody, hoseTip);
      hoseToolGroup.visible = false;
      scene.add(hoseToolGroup);

      const sandToolGroup = new THREE.Group();
      const bucketBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.19, 0.32, 12),
        new THREE.MeshStandardMaterial({ color: "#c98a3b" }),
      );
      sandToolGroup.add(bucketBody);
      sandToolGroup.visible = false;
      scene.add(sandToolGroup);

      let fireHealth = 1;
      let sandCoverage = 0;
      let fireMidwayFired = false;
      let fireOutFired = false;
      let flameAccum = 0;
      let smokeAccum = 0;
      let fireBurstAccum = 0;
      let fireToolAccum = 0;
      const fireNozzleTarget = new THREE.Vector3(STATION_X.fire, 2.0, 0);

      function resetFire() {
        fireHealth = 1;
        sandCoverage = 0;
        fireMidwayFired = false;
        fireOutFired = false;
        sandMound.scale.setScalar(0.001);
      }
      resetHandlersRef.current.fire = resetFire;

      // =====================================================================
      // WATER station
      // =====================================================================
      const waterGroup = new THREE.Group();
      waterGroup.position.set(STATION_X.water, 0, 0);
      scene.add(waterGroup);

      const basinRim = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.13, 10, 28),
        new THREE.MeshStandardMaterial({ color: "#9aa2a8", roughness: 0.7 }),
      );
      basinRim.rotation.x = Math.PI / 2;
      basinRim.position.y = 0.14;
      waterGroup.add(basinRim);
      const basinFloor = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 0.9, 0.16, 24),
        new THREE.MeshStandardMaterial({ color: "#7d848a", roughness: 0.8 }),
      );
      basinFloor.position.y = 0.06;
      waterGroup.add(basinFloor);

      const waterSurface = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 0.06, 24),
        new THREE.MeshStandardMaterial({ color: "#5fb8ff", transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.1 }),
      );
      waterSurface.position.y = 0.08;
      waterGroup.add(waterSurface);

      const waterSpout = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.32, 10),
        new THREE.MeshStandardMaterial({ color: "#3f7fb0" }),
      );
      waterSpout.rotation.x = Math.PI;
      waterSpout.visible = false;
      scene.add(waterSpout);

      let fillLevel = 0;
      let waterMidwayFired = false;
      let waterFullFired = false;
      let pourAccum = 0;
      let splashAccum = 0;

      function resetWater() {
        fillLevel = 0;
        waterMidwayFired = false;
        waterFullFired = false;
      }
      resetHandlersRef.current.water = resetWater;

      // =====================================================================
      // WIND station
      // =====================================================================
      const windGroup = new THREE.Group();
      windGroup.position.set(STATION_X.wind, 0, 0);
      scene.add(windGroup);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 2.1, 10),
        new THREE.MeshStandardMaterial({ color: "#b7bcc2" }),
      );
      pole.position.y = 1.05;
      windGroup.add(pole);

      const bladeGroup = new THREE.Group();
      bladeGroup.position.y = 2.05;
      windGroup.add(bladeGroup);
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 14, 10),
        new THREE.MeshStandardMaterial({ color: "#e2564f" }),
      );
      bladeGroup.add(hub);
      const bladeColors = ["#ffffff", "#ffd76a", "#ffffff", "#ffd76a"];
      for (let i = 0; i < 4; i += 1) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.85, 0.24, 0.03),
          new THREE.MeshStandardMaterial({ color: bladeColors[i] }),
        );
        blade.position.x = 0.5;
        const pivot = new THREE.Group();
        pivot.rotation.z = (i / 4) * Math.PI * 2;
        pivot.add(blade);
        bladeGroup.add(pivot);
      }

      let windStrength = 0;
      let windLastAim = new THREE.Vector3(STATION_X.wind, 0, 0);
      let windAimValid = false;
      let windSustainTimer = 0;
      let windBuildingFired = false;
      let windCompleteFired = false;
      let leafAccum = 0;

      function resetWind() {
        windStrength = 0;
        windSustainTimer = 0;
        windBuildingFired = false;
        windCompleteFired = false;
      }
      resetHandlersRef.current.wind = resetWind;

      // =====================================================================
      // PLANT station
      // =====================================================================
      const plantGroup = new THREE.Group();
      plantGroup.position.set(STATION_X.plant, 0, 0);
      scene.add(plantGroup);

      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.38, 0.5, 16),
        new THREE.MeshStandardMaterial({ color: "#b5673a", roughness: 0.85 }),
      );
      pot.position.y = 0.25;
      plantGroup.add(pot);
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: "#4a3320", roughness: 1 }),
      );
      soil.position.y = 0.53;
      plantGroup.add(soil);

      const seedMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 8),
        new THREE.MeshStandardMaterial({ color: "#caa25a" }),
      );
      seedMesh.position.y = 0.58;
      plantGroup.add(seedMesh);

      const stemPivot = new THREE.Group();
      stemPivot.position.y = 0.57;
      stemPivot.scale.y = 0.001;
      plantGroup.add(stemPivot);
      const STEM_HEIGHT = 1.7;
      const stemGeometry = new THREE.CylinderGeometry(0.045, 0.06, STEM_HEIGHT, 8);
      stemGeometry.translate(0, STEM_HEIGHT / 2, 0);
      const stem = new THREE.Mesh(stemGeometry, new THREE.MeshStandardMaterial({ color: "#4c9a3f" }));
      stemPivot.add(stem);

      const leafGroup = new THREE.Group();
      leafGroup.position.y = STEM_HEIGHT * 0.5;
      leafGroup.scale.setScalar(0.001);
      stemPivot.add(leafGroup);
      [-1, 1].forEach((side) => {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 10, 8),
          new THREE.MeshStandardMaterial({ color: "#5cb24a" }),
        );
        leaf.scale.set(1.6, 0.5, 0.9);
        leaf.position.set(side * 0.32, 0, 0);
        leafGroup.add(leaf);
      });

      const flowerGroup = new THREE.Group();
      flowerGroup.position.y = STEM_HEIGHT;
      flowerGroup.scale.setScalar(0.001);
      stemPivot.add(flowerGroup);
      const flowerCenter = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 10),
        new THREE.MeshStandardMaterial({ color: "#ffd76a" }),
      );
      flowerGroup.add(flowerCenter);
      for (let i = 0; i < 6; i += 1) {
        const petalAngle = (i / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 10, 8),
          new THREE.MeshStandardMaterial({ color: "#ff7fa8" }),
        );
        petal.scale.set(1.3, 0.6, 0.7);
        petal.position.set(Math.cos(petalAngle) * 0.2, 0, Math.sin(petalAngle) * 0.2);
        flowerGroup.add(petal);
      }

      const plantSpout = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: "#3f7fb0" }),
      );
      plantSpout.rotation.x = Math.PI;
      plantSpout.visible = false;
      scene.add(plantSpout);

      const sunGroup = new THREE.Group();
      sunGroup.position.set(STATION_X.plant, -2.2, -1.6);
      scene.add(sunGroup);
      const sunCoreMaterial = new THREE.MeshBasicMaterial({ color: "#ffe37a", transparent: true, opacity: 0 });
      const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), sunCoreMaterial);
      sunGroup.add(sunCore);
      const sunGlowLayers: { material: THREE.SpriteMaterial; baseOpacity: number }[] = [
        { scale: 2.2, color: "#ffe08a", opacity: 0.55 },
        { scale: 3.6, color: "#ffb347", opacity: 0.3 },
      ].map((layer) => {
        const material = new THREE.SpriteMaterial({
          map: createGlowTexture(layer.color),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(layer.scale, layer.scale, 1);
        sunGroup.add(sprite);
        return { material, baseOpacity: layer.opacity };
      });

      let plantStage: 0 | 1 | 2 | 3 = 0;
      let waterMeter = 0;
      let growTimer = 0;
      let plantPourAccum = 0;
      let stemScale = 0.001;
      let stemVel = 0;
      let leafScale = 0.001;
      let leafVel = 0;
      let flowerScale = 0.001;
      let flowerVel = 0;
      let seedScale = 1;
      let seedVel = 0;

      function resetPlant() {
        plantStage = 0;
        waterMeter = 0;
        growTimer = 0;
        stemScale = 0.001;
        stemVel = 0;
        leafScale = 0.001;
        leafVel = 0;
        flowerScale = 0.001;
        flowerVel = 0;
        seedScale = 1;
        seedVel = 0;
      }
      resetHandlersRef.current.plant = resetPlant;

      // --- Resize (writes the canvas CSS size, not just its pixel-buffer
      // attribute size — see EarthScene's identical note: with DPR 2 on the
      // kiosk's 200% scaling, the attribute size would otherwise become the
      // layout size and overflow the stage). ------------------------------
      const resize = () => {
        const { clientWidth, clientHeight } = mount;
        if (!clientWidth || !clientHeight) return;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      // --- Pointer: drag aims the active station's tool (no camera orbit
      // here — the camera is always eased to whichever station is active,
      // so a single pointer is free to mean "aim spray / pour / blow"). ---
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const planeHit = new THREE.Vector3();
      const aimPoint = new THREE.Vector3(STATION_X.fire, 0, 0);
      let dragActive = false;
      let dragPointerId: number | null = null;

      function updateAimFromEvent(event: PointerEvent) {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
          const bounds = STATION_BOUNDS[activeStationRef.current];
          aimPoint.set(
            THREE.MathUtils.clamp(planeHit.x, bounds.x[0], bounds.x[1]),
            0,
            THREE.MathUtils.clamp(planeHit.z, bounds.z[0], bounds.z[1]),
          );
        }
      }

      const onPointerDown = (event: PointerEvent) => {
        renderer.domElement.setPointerCapture(event.pointerId);
        dragPointerId = event.pointerId;
        dragActive = true;
        updateAimFromEvent(event);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== dragPointerId) return;
        updateAimFromEvent(event);
      };
      const endPointer = (event: PointerEvent) => {
        if (event.pointerId !== dragPointerId) return;
        try {
          renderer.domElement.releasePointerCapture(event.pointerId);
        } catch {
          /* pointer capture may already be released */
        }
        dragActive = false;
        dragPointerId = null;
      };

      const onContextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        const message = "The 3D lab stopped drawing.";
        setError(message);
        onErrorRef.current?.(message);
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", endPointer);
      renderer.domElement.addEventListener("pointercancel", endPointer);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      // --- Per-station tick functions --------------------------------------
      function tickFire(delta: number) {
        flameAccum += delta * 65 * fireHealth;
        while (flameAccum >= 1) {
          flameAccum -= 1;
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.32;
          const hue = 0.03 + Math.random() * 0.09;
          flamePool.emit({
            position: new THREE.Vector3(STATION_X.fire + Math.cos(angle) * r, 0.16, Math.sin(angle) * r),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4),
            color: new THREE.Color().setHSL(hue, 1, 0.55 + Math.random() * 0.15),
            peakSize: (0.55 + Math.random() * 0.4) * (0.35 + fireHealth * 0.85),
            endSize: 0.04,
            life: 0.45 + Math.random() * 0.3,
          });
        }
        if (Math.random() < delta * 5 * fireHealth) {
          sparkPool.emit({
            position: new THREE.Vector3(STATION_X.fire + (Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.2 + Math.random(), (Math.random() - 0.5) * 0.6),
            color: new THREE.Color("#ffe27a"),
            peakSize: 0.14,
            endSize: 0.02,
            life: 0.7 + Math.random() * 0.5,
          });
        }
        smokeAccum += delta * (3.5 + (1 - fireHealth) * 9) * Math.min(1, fireHealth + 0.25);
        while (smokeAccum >= 1) {
          smokeAccum -= 1;
          smokePool.emit({
            position: new THREE.Vector3(STATION_X.fire + (Math.random() - 0.5) * 0.3, 0.5, (Math.random() - 0.5) * 0.3),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2),
            color: new THREE.Color("#c9cfd4"),
            peakSize: 0.45 + Math.random() * 0.3,
            endSize: 0.7,
            life: 1.3 + Math.random() * 0.7,
          });
        }

        sandMound.scale.setScalar(THREE.MathUtils.lerp(sandMound.scale.x, Math.max(0.001, sandCoverage), Math.min(1, delta * 4)));

        const isActive = activeStationRef.current === "fire";
        const tool = fireToolRef.current;
        hoseToolGroup.visible = isActive && tool === "hose";
        sandToolGroup.visible = isActive && tool === "sand";
        const activeToolMesh = tool === "hose" ? hoseToolGroup : tool === "sand" ? sandToolGroup : null;

        if (isActive && tool) {
          if (dragActive) {
            fireNozzleTarget.set(aimPoint.x, 2.0, aimPoint.z);
          } else {
            fireNozzleTarget.set(STATION_X.fire, 2.0, 0);
          }
        }
        if (activeToolMesh) {
          activeToolMesh.position.lerp(fireNozzleTarget, Math.min(1, delta * 6));
        }

        if (isActive && tool && dragActive && fireHealth > 0) {
          const pool = tool === "hose" ? dropletPool : grainPool;
          const rate = tool === "hose" ? 90 : 70;
          fireToolAccum += delta * rate;
          while (fireToolAccum >= 1) {
            fireToolAccum -= 1;
            const jitterX = (Math.random() - 0.5) * 0.3;
            const jitterZ = (Math.random() - 0.5) * 0.3;
            pool.emit({
              position: new THREE.Vector3(fireNozzleTarget.x + jitterX, fireNozzleTarget.y, fireNozzleTarget.z + jitterZ),
              velocity: new THREE.Vector3(jitterX * 0.6, -0.4, jitterZ * 0.6),
              color: tool === "hose" ? new THREE.Color("#7fd4ff") : new THREE.Color("#e0bd6a"),
              peakSize: tool === "hose" ? 0.2 : 0.24,
              endSize: 0.02,
              life: 0.4 + Math.random() * 0.2,
            });
          }

          const dx = aimPoint.x - STATION_X.fire;
          const dz = aimPoint.z;
          const hitting = Math.sqrt(dx * dx + dz * dz) < 1.5;
          if (hitting) {
            const drainRate = tool === "hose" ? 0.22 : 0.17;
            fireHealth = Math.max(0, fireHealth - delta * drainRate);
            if (tool === "sand") sandCoverage = Math.min(1, sandCoverage + delta * 0.22);

            fireBurstAccum += delta;
            if (fireBurstAccum > 0.28) {
              fireBurstAccum = 0;
              const burstPoolToUse = tool === "hose" ? burstPool : dustPool;
              const burstColor = tool === "hose" ? new THREE.Color("#eaf6ff") : new THREE.Color("#d8c08a");
              for (let k = 0; k < 7; k += 1) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * 0.4;
                burstPoolToUse.emit({
                  position: new THREE.Vector3(STATION_X.fire + Math.cos(a) * r, 0.25 + Math.random() * 0.2, Math.sin(a) * r),
                  velocity: new THREE.Vector3(Math.cos(a) * 0.6, 0.7 + Math.random() * 0.6, Math.sin(a) * 0.6),
                  color: burstColor,
                  peakSize: 0.35 + Math.random() * 0.25,
                  endSize: 0.05,
                  life: 0.55 + Math.random() * 0.35,
                });
              }
            }

            if (!fireMidwayFired && fireHealth <= 0.5) {
              fireMidwayFired = true;
              onEventRef.current({ type: "fire-midway" });
            }
            if (!fireOutFired && fireHealth <= 0) {
              fireOutFired = true;
              onEventRef.current({ type: "fire-out" });
            }
          }
        }
      }

      function tickWater(delta: number) {
        const isActive = activeStationRef.current === "water";
        waterSpout.visible = isActive;
        if (isActive) {
          const target = dragActive
            ? new THREE.Vector3(aimPoint.x, 2.0, aimPoint.z)
            : new THREE.Vector3(STATION_X.water, 2.0, 0);
          waterSpout.position.lerp(target, Math.min(1, delta * 6));

          if (dragActive) {
            pourAccum += delta * 130;
            while (pourAccum >= 1) {
              pourAccum -= 1;
              const jitterX = (Math.random() - 0.5) * 0.15;
              const jitterZ = (Math.random() - 0.5) * 0.15;
              dropletPool.emit({
                position: new THREE.Vector3(waterSpout.position.x + jitterX, waterSpout.position.y, waterSpout.position.z + jitterZ),
                velocity: new THREE.Vector3(jitterX, -0.3, jitterZ),
                color: new THREE.Color("#5fb8ff"),
                peakSize: 0.2,
                endSize: 0.02,
                life: 0.4 + Math.random() * 0.2,
              });
            }

            const dx = aimPoint.x - STATION_X.water;
            const dz = aimPoint.z;
            if (Math.sqrt(dx * dx + dz * dz) < 1.05 && fillLevel < 1) {
              fillLevel = Math.min(1, fillLevel + delta * 0.16);
              splashAccum += delta;
              if (splashAccum > 0.22) {
                splashAccum = 0;
                for (let k = 0; k < 9; k += 1) {
                  const a = Math.random() * Math.PI * 2;
                  burstPool.emit({
                    position: new THREE.Vector3(STATION_X.water + Math.cos(a) * 0.3, 0.45 + fillLevel * 0.4, Math.sin(a) * 0.3),
                    velocity: new THREE.Vector3(Math.cos(a) * 1.0, 1.5 + Math.random(), Math.sin(a) * 1.0),
                    color: new THREE.Color("#bfe8ff"),
                    peakSize: 0.22,
                    endSize: 0.03,
                    life: 0.45 + Math.random() * 0.3,
                  });
                }
              }
              if (!waterMidwayFired && fillLevel >= 0.5) {
                waterMidwayFired = true;
                onEventRef.current({ type: "water-midway" });
              }
              if (!waterFullFired && fillLevel >= 1) {
                waterFullFired = true;
                onEventRef.current({ type: "water-full" });
              }
            }
          }
        }
        const targetY = 0.09 + fillLevel * 0.4;
        waterSurface.position.y += (targetY - waterSurface.position.y) * Math.min(1, delta * 3);
        (waterSurface.material as THREE.MeshStandardMaterial).opacity = 0.3 + fillLevel * 0.5;
      }

      function tickWind(delta: number) {
        const isActive = activeStationRef.current === "wind";
        if (isActive && dragActive) {
          if (windAimValid) {
            const dx = aimPoint.x - windLastAim.x;
            const dz = aimPoint.z - windLastAim.z;
            const speed = Math.sqrt(dx * dx + dz * dz) / Math.max(delta, 0.001);
            windStrength = THREE.MathUtils.clamp(windStrength + speed * 0.018 * delta, 0, 1);
          }
          windLastAim.copy(aimPoint);
          windAimValid = true;
        } else {
          windAimValid = false;
        }
        windStrength = Math.max(0, windStrength - delta * 0.28);

        bladeGroup.rotation.z += delta * (0.4 + windStrength * 11);

        leafAccum += delta * (6 + windStrength * 55);
        while (leafAccum >= 1) {
          leafAccum -= 1;
          const y = 0.4 + Math.random() * 1.6;
          const z = (Math.random() - 0.5) * 2.4;
          leafPool.emit({
            position: new THREE.Vector3(STATION_X.wind - 2.4, y, z),
            velocity: new THREE.Vector3(0.5 + windStrength * 3.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4),
            color: new THREE.Color(LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]),
            peakSize: 0.2 + Math.random() * 0.12,
            endSize: 0.05,
            life: 1.5 + Math.random(),
          });
        }

        if (!windBuildingFired && windStrength > 0.35) {
          windBuildingFired = true;
          onEventRef.current({ type: "wind-building" });
        }
        if (windStrength > 0.6) {
          windSustainTimer += delta;
        } else {
          windSustainTimer = Math.max(0, windSustainTimer - delta * 1.5);
        }
        if (!windCompleteFired && windSustainTimer > 2.2) {
          windCompleteFired = true;
          onEventRef.current({ type: "wind-complete" });
        }
      }

      function tickPlant(delta: number) {
        const isActive = activeStationRef.current === "plant";
        plantSpout.visible = isActive;
        if (isActive) {
          const target = dragActive
            ? new THREE.Vector3(aimPoint.x, 1.6, aimPoint.z)
            : new THREE.Vector3(STATION_X.plant, 1.6, 0);
          plantSpout.position.lerp(target, Math.min(1, delta * 6));

          if (dragActive && plantStage === 0) {
            plantPourAccum += delta * 110;
            while (plantPourAccum >= 1) {
              plantPourAccum -= 1;
              dropletPool.emit({
                position: plantSpout.position.clone(),
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.4, (Math.random() - 0.5) * 0.2),
                color: new THREE.Color("#5fb8ff"),
                peakSize: 0.17,
                endSize: 0.02,
                life: 0.4,
              });
            }
            const dx = aimPoint.x - STATION_X.plant;
            const dz = aimPoint.z;
            if (Math.sqrt(dx * dx + dz * dz) < 0.85) {
              waterMeter = Math.min(1, waterMeter + delta * 0.35);
              if (waterMeter >= 1 && plantStage === 0) {
                plantStage = 1;
                onEventRef.current({ type: "plant-sprout" });
              }
            }
          }
        }

        if (sunOutRef.current && plantStage >= 1 && plantStage < 3) {
          growTimer += delta;
          if (growTimer > 2.4) {
            growTimer = 0;
            plantStage = (plantStage + 1) as 0 | 1 | 2 | 3;
            if (plantStage === 2) {
              onEventRef.current({ type: "plant-growing" });
            } else {
              onEventRef.current({ type: "plant-complete" });
            }
          }
        }

        const sunTargetY = sunOutRef.current ? 3.6 : -2.2;
        sunGroup.position.y += (sunTargetY - sunGroup.position.y) * Math.min(1, delta * 1.8);
        const sunOn = sunOutRef.current ? 1 : 0;
        sunCoreMaterial.opacity += (sunOn - sunCoreMaterial.opacity) * Math.min(1, delta * 2);
        sunGlowLayers.forEach(({ material, baseOpacity }) => {
          material.opacity += (baseOpacity * sunOn - material.opacity) * Math.min(1, delta * 2);
        });

        const stemTarget = plantStage >= 3 ? 1 : plantStage >= 2 ? 0.78 : plantStage >= 1 ? 0.4 : 0.001;
        const leafTarget = plantStage >= 2 ? 1 : 0.001;
        const flowerTarget = plantStage >= 3 ? 1 : 0.001;
        const seedTarget = plantStage >= 1 ? 0.001 : 1;

        ({ value: stemScale, velocity: stemVel } = springTo(stemScale, stemVel, stemTarget, delta));
        stemPivot.scale.y = Math.max(0.001, stemScale);
        ({ value: leafScale, velocity: leafVel } = springTo(leafScale, leafVel, leafTarget, delta));
        leafGroup.scale.setScalar(Math.max(0.001, leafScale));
        ({ value: flowerScale, velocity: flowerVel } = springTo(flowerScale, flowerVel, flowerTarget, delta));
        flowerGroup.scale.setScalar(Math.max(0.001, flowerScale));
        ({ value: seedScale, velocity: seedVel } = springTo(seedScale, seedVel, seedTarget, delta));
        seedMesh.scale.setScalar(Math.max(0.001, seedScale));
      }

      // --- Camera rig: eases toward whichever station is active; the rest
      // of the lab keeps quietly animating in the background regardless. --
      const camPos = new THREE.Vector3(STATION_X.fire, 2.8, 7.6);
      const camLook = new THREE.Vector3(STATION_X.fire, 1.3, 0);

      // --- Animation loop ---------------------------------------------------
      const clock = new THREE.Clock();
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.1);

        tickFire(delta);
        tickWater(delta);
        tickWind(delta);
        tickPlant(delta);

        pools.forEach((pool) => pool.update(delta));

        const targetX = STATION_X[activeStationRef.current];
        const lerpAlpha = Math.min(1, delta * 2.6);
        camPos.x += (targetX - camPos.x) * lerpAlpha;
        camPos.y += (2.8 - camPos.y) * lerpAlpha;
        camPos.z += (7.6 - camPos.z) * lerpAlpha;
        camLook.x += (targetX - camLook.x) * lerpAlpha;
        camLook.y += (1.3 - camLook.y) * lerpAlpha;
        camLook.z += (0 - camLook.z) * lerpAlpha;
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", endPointer);
        renderer.domElement.removeEventListener("pointercancel", endPointer);
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        disposeObject3D(scene);
        // ShaderMaterial particle pools use a custom `uniforms.map` (not the
        // conventional `.map` property disposeObject3D's generic traversal
        // knows how to find), and the sprite texture is shared across all
        // eight pools — dispose it once, here, after every pool's own
        // geometry/material has already been swept by disposeObject3D.
        dotTexture.dispose();
        renderer.dispose();
        // Browsers cap live WebGL contexts; without a forced release the old
        // context lingers until GC and days of page hops brick the kiosk
        // (same lesson EarthScene/SolarSystemScene already learned).
        renderer.forceContextLoss();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div ref={mountRef} className={`touch-none ${className ?? ""}`}>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-xl rounded-3xl bg-white/95 p-6 text-center shadow-2xl">
              <p className="text-2xl font-black text-slate-900">
                Science Lab needs 3D graphics
              </p>
              <p className="mt-2 text-lg font-bold text-slate-600">
                {error} The station buttons below still work.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
