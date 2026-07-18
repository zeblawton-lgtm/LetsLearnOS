// ---------------------------------------------------------------------------
// Rocket Launch 3D renderer (WebGL / three.js) — ADR-019. A single persistent
// scene holds the whole launchpad diorama: a stylized rocket (nose cone,
// capsule, fins, fuel tank, engine bells, escape tower — all built from
// primitives, no imported models), a launch tower, a ground plane, a
// daytime sky that darkens with altitude, drifting clouds, and a fading-in
// starfield. Lifecycle discipline copied wholesale from ScienceScene /
// EarthScene (ADR-014): capped device pixel ratio, ResizeObserver-driven
// resize (writes CSS size, not just the pixel buffer), a single mount effect
// that never rebuilds, webglcontextlost handling with a narrated fallback,
// and full geometry/material/texture disposal + forceContextLoss on unmount.
//
// Two phases live inside this one scene, switched by a tiny internal state
// machine (`launchStage`) driven by the imperative handle rather than props
// — same "physics owns its own state, refs mirror the reactive props"
// discipline as ScienceScene's per-station tick functions:
//   "pad"     — rocket idle on the pad; tap-to-select a part (raycast with a
//               generous screen-space fallback, same trick as
//               EarthScene/SolarSystemScene's resolveTap) eases the camera
//               in and pops an emissive highlight; camera otherwise eases to
//               an overview framing the whole diorama.
//   "ignition"— triggered by RocketHandle.startLaunch(): thrust ramps up,
//               fire/smoke/sparks pour from the engines, camera shake ramps.
//               No motion yet — a real rocket holds down until thrust beats
//               its own weight.
//   "ascend"  — once thrust > GRAVITY_MAG the rocket actually lifts off;
//               thrust keeps ramping to MAX_THRUST, altitude integrates
//               upward, the sky lerps from day-blue toward space-black, and
//               the starfield fades in as altitude climbs.
//   "orbit"   — thrust eases back to a gentle hover-trim, velocity eases to
//               ~0 with a tiny sine bob, a dashed "orbit line" ring fades in
//               around the rocket, and a one-shot confetti burst celebrates.
// Physics are a plain custom integration (thrust - gravity, per ADR-019 "no
// new dependencies") using the same capped `delta` as every other scene.
// ---------------------------------------------------------------------------
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { ROCKET_PART_ORDER, type RocketPartId } from "@/content/rocket";
import { ParticlePool, springTo } from "@/lib/science-particles";
import {
  createGlowTexture,
  createStarfieldGeometry,
  createStarSpriteTexture,
} from "@/lib/space-textures";

export type RocketEvent =
  | { type: "ignition" }
  | { type: "liftoff" }
  | { type: "sky-darkening" }
  | { type: "reaching-space" }
  | { type: "orbit" };

export interface RocketHandle {
  /** Kicks off the ignition -> ascend -> orbit physics timeline. Called by
   *  the page once the spoken countdown finishes ("Blast off!"). */
  startLaunch: () => void;
  /** "Fly Again": stops the flight, snaps the rocket back to the pad, and
   *  returns the camera to the learn-phase overview. */
  resetToPad: () => void;
}

interface RocketSceneProps {
  /** Which part is highlighted + camera-focused; null = overview framing. */
  selectedPart: RocketPartId | null;
  /** True only during the "pad" learn phase, before Launch is pressed — taps
   *  are ignored once the countdown/launch sequence has started. */
  interactive: boolean;
  /** Parent owns playTap/TTS so every entry point (3D tap, picker dock)
   *  narrates exactly once (same discipline as onSelectContinent). */
  onSelectPart: (id: RocketPartId) => void;
  /** Fired at physics milestones, each exactly once per flight — parent owns
   *  narration timing (same one-shot-latch discipline as ScienceEvent). */
  onEvent: (event: RocketEvent) => void;
  onError?: (message: string) => void;
  className?: string;
}

type LaunchStage = "pad" | "ignition" | "ascend" | "orbit";

// --- Rocket geometry layout (local Y, engines-bottom = 0) ------------------
const ENGINE_BOTTOM_Y = 0;
const ENGINE_TOP_Y = 0.6;
const BODY_BOTTOM_Y = 0.6;
const BODY_TOP_Y = 5.2;
const FIN_BOTTOM_Y = 0.6;
const CAPSULE_BOTTOM_Y = 5.2;
const CAPSULE_TOP_Y = 6.1;
const NOSE_BOTTOM_Y = 6.1;
const NOSE_TOP_Y = 7.4;
// Escape tower spans TOWER_BOTTOM_Y..8.65 (mast + cap, see the meshes below);
// PART_META['escape-tower'].centerY is hand-tuned against that same range.
const TOWER_BOTTOM_Y = 7.4;
const BODY_RADIUS = 0.78;

// Hand-tuned centers/reach per part for camera framing + the selection ring
// (eyeballed against the geometry above, not measured — good enough to
// frame a part, not precise enough to be a bounding box).
const PART_META: Record<RocketPartId, { centerY: number; reach: number }> = {
  "escape-tower": { centerY: 8.03, reach: 0.7 },
  "nose-cone": { centerY: 6.75, reach: 0.75 },
  capsule: { centerY: 5.65, reach: 0.7 },
  fins: { centerY: 1.2, reach: 1.3 },
  "fuel-tank": { centerY: 2.9, reach: 1.3 },
  engines: { centerY: 0.3, reach: 0.9 },
};

// --- Flight physics tuning (custom, no physics-engine dependency) ----------
const GRAVITY_MAG = 4.2;
const MAX_THRUST = 9.5;
const THRUST_RAMP_IGNITION = 5.0;
const THRUST_RAMP_ASCEND = 2.5;
const ORBIT_ALTITUDE = 26;
const MAX_SHAKE = 0.09;
const TAP_SLOP = 12; // toddlers need generous slop (EarthScene precedent)

const STAR_LAYERS = [
  { count: 2600, radius: 140, size: 0.55, opacity: 0.55, colors: ["#ffffff", "#cfe3ff"] },
  { count: 1200, radius: 100, size: 0.95, opacity: 0.75, colors: ["#ffffff", "#dce8ff", "#fff3d6"] },
  { count: 380, radius: 70, size: 1.6, opacity: 0.9, colors: ["#ffffff", "#ffe9b0"] },
];
const STAR_SPIN_RATE = 0.0015;

const HIGHLIGHT_COLOR = new THREE.Color("#ffde59");
const IGNITION_GLOW_COLOR = new THREE.Color("#ff6a2b");

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

// Runtime canvas-2D launchpad ground texture (offline, no bundled imagery) —
// grass field with a big concrete pad apron in the middle, same
// gradient+noise approach as ScienceScene's makeGroundTexture.
function makePadGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grass = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grass.addColorStop(0, "#7cc36a");
  grass.addColorStop(1, "#5da250");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3, 3);
  }

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const padR = canvas.width * 0.3;
  const padGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, padR);
  padGrad.addColorStop(0, "#b7bcc2");
  padGrad.addColorStop(0.85, "#9aa0a6");
  padGrad.addColorStop(1, "rgba(154,160,166,0)");
  ctx.fillStyle = padGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, padR, 0, Math.PI * 2);
  ctx.fill();

  // Flame trench cross under the engines.
  ctx.fillStyle = "#5c6167";
  ctx.fillRect(cx - padR * 0.16, cy - padR * 0.75, padR * 0.32, padR * 1.5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeFinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(BODY_RADIUS - 0.04, 0);
  shape.lineTo(BODY_RADIUS + 0.85, 0.14);
  shape.lineTo(BODY_RADIUS + 0.5, 1.0);
  shape.lineTo(BODY_RADIUS - 0.04, 1.1);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -0.05);
  return geometry;
}

export const RocketScene = forwardRef<RocketHandle, RocketSceneProps>(
  function RocketScene(
    { selectedPart, interactive, onSelectPart, onEvent, onError, className },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const selectedPartRef = useRef(selectedPart);
    const interactiveRef = useRef(interactive);
    const onSelectRef = useRef(onSelectPart);
    const onEventRef = useRef(onEvent);
    const onErrorRef = useRef(onError);
    const actionsRef = useRef<RocketHandle | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      selectedPartRef.current = selectedPart;
    }, [selectedPart]);
    useEffect(() => {
      interactiveRef.current = interactive;
    }, [interactive]);
    useEffect(() => {
      onSelectRef.current = onSelectPart;
    }, [onSelectPart]);
    useEffect(() => {
      onEventRef.current = onEvent;
    }, [onEvent]);
    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    useImperativeHandle(
      ref,
      () => ({
        startLaunch: () => actionsRef.current?.startLaunch(),
        resetToPad: () => actionsRef.current?.resetToPad(),
      }),
      [],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; scene lives for the component's lifetime
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const scene = new THREE.Scene();
      const skyDay = new THREE.Color("#bfe3ff");
      const skySpace = new THREE.Color("#03040c");
      scene.background = skyDay.clone();
      scene.fog = new THREE.Fog("#bfe3ff", 20, 55);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 260);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        setError(null);
      } catch (err) {
        console.error("Unable to start the rocket scene.", err);
        const message = "This device could not start the 3D launchpad.";
        setError(message);
        onErrorRef.current?.(message);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.touchAction = "none";
      mount.appendChild(renderer.domElement);

      // --- Lighting ---------------------------------------------------------
      const hemiLight = new THREE.HemisphereLight("#eaf6ff", "#3a4326", 0.9);
      scene.add(hemiLight);
      const keyLight = new THREE.DirectionalLight("#fff6da", 1.6);
      keyLight.position.set(7, 12, 7);
      scene.add(keyLight);

      // --- Ground -------------------------------------------------------------
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(70, 70),
        new THREE.MeshStandardMaterial({ map: makePadGroundTexture(), roughness: 0.95 }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      // --- Launch tower (decorative gantry, does not move with the rocket) --
      const towerGroup = new THREE.Group();
      towerGroup.position.set(-4.4, 0, -1.6);
      scene.add(towerGroup);
      const beamMaterial = new THREE.MeshStandardMaterial({
        color: "#8a8f96",
        roughness: 0.7,
        metalness: 0.3,
      });
      const beamGeometry = new THREE.BoxGeometry(0.12, 9, 0.12);
      [
        [-0.6, -0.6],
        [0.6, -0.6],
        [-0.6, 0.6],
        [0.6, 0.6],
      ].forEach(([x, z]) => {
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.set(x, 4.5, z);
        towerGroup.add(beam);
      });
      const braceXGeometry = new THREE.BoxGeometry(1.3, 0.08, 0.08);
      const braceZGeometry = new THREE.BoxGeometry(0.08, 0.08, 1.3);
      for (let h = 1; h < 9; h += 1.5) {
        const braceA = new THREE.Mesh(braceXGeometry, beamMaterial);
        braceA.position.set(0, h, -0.6);
        towerGroup.add(braceA);
        const braceB = new THREE.Mesh(braceXGeometry, beamMaterial);
        braceB.position.set(0, h, 0.6);
        towerGroup.add(braceB);
        const braceC = new THREE.Mesh(braceZGeometry, beamMaterial);
        braceC.position.set(-0.6, h, 0);
        towerGroup.add(braceC);
        const braceD = new THREE.Mesh(braceZGeometry, beamMaterial);
        braceD.position.set(0.6, h, 0);
        towerGroup.add(braceD);
      }
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshStandardMaterial({ color: "#ff3b30", emissive: "#ff3b30", emissiveIntensity: 1 }),
      );
      beacon.position.set(0, 9.1, 0);
      towerGroup.add(beacon);

      // --- Drifting sky clouds (fade out as the rocket leaves the atmosphere)
      const cloudTexture = createGlowTexture("#ffffff");
      const cloudBaseX = [-11, -4, 5, 12, 0];
      const clouds: THREE.Sprite[] = cloudBaseX.map((x, i) => {
        const material = new THREE.SpriteMaterial({
          map: cloudTexture,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, 9 + i * 0.4, -7 - i);
        sprite.scale.set(6 + i, 2.8 + i * 0.3, 1);
        scene.add(sprite);
        return sprite;
      });

      // --- Starfield (hidden at ground level, fades in with altitude) -------
      const starGroup = new THREE.Group();
      const starSprite = createStarSpriteTexture();
      const starLayers = STAR_LAYERS.map((layer) => {
        const geometry = createStarfieldGeometry(layer);
        const material = new THREE.PointsMaterial({
          size: layer.size,
          map: starSprite,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          vertexColors: true,
          sizeAttenuation: true,
        });
        const points = new THREE.Points(geometry, material);
        starGroup.add(points);
        return { material, baseOpacity: layer.opacity };
      });
      scene.add(starGroup);

      // --- Rocket -------------------------------------------------------------
      const rocketGroup = new THREE.Group();
      scene.add(rocketGroup);

      const raycastMeshes: THREE.Object3D[] = [];
      const meshToPart = new Map<THREE.Object3D, RocketPartId>();
      const partMeshes: Record<RocketPartId, THREE.Mesh[]> = {
        "escape-tower": [],
        "nose-cone": [],
        capsule: [],
        fins: [],
        "fuel-tank": [],
        engines: [],
      };
      function registerPart(id: RocketPartId, mesh: THREE.Mesh) {
        partMeshes[id].push(mesh);
        raycastMeshes.push(mesh);
        meshToPart.set(mesh, id);
      }

      // Engines: one central bell + four smaller outer bells, all sharing one
      // material so ignition glow only needs to touch a single object.
      const engineMaterial = new THREE.MeshStandardMaterial({
        color: "#5b6570",
        roughness: 0.55,
        metalness: 0.45,
        emissive: "#000000",
        emissiveIntensity: 0,
      });
      const centralEngine = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 14), engineMaterial);
      centralEngine.position.y = ENGINE_TOP_Y - 0.35;
      rocketGroup.add(centralEngine);
      registerPart("engines", centralEngine);
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const outerEngine = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 12), engineMaterial);
        outerEngine.position.set(Math.cos(angle) * 0.52, ENGINE_TOP_Y - 0.225, Math.sin(angle) * 0.52);
        rocketGroup.add(outerEngine);
        registerPart("engines", outerEngine);
      }
      const engineWorldPos = new THREE.Vector3();

      // Fuel tank / body, with a painted band near the top.
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#eef2f6", roughness: 0.55, metalness: 0.1 });
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, BODY_RADIUS, BODY_TOP_Y - BODY_BOTTOM_Y, 20),
        bodyMaterial,
      );
      body.position.y = (BODY_BOTTOM_Y + BODY_TOP_Y) / 2;
      rocketGroup.add(body);
      registerPart("fuel-tank", body);
      const bandMaterial = new THREE.MeshStandardMaterial({ color: "#e0483c", roughness: 0.6 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.635, 0.635, 0.4, 20), bandMaterial);
      band.position.y = BODY_TOP_Y - 0.5;
      rocketGroup.add(band);
      registerPart("fuel-tank", band);

      // Fins: 4 trapezoid panels around the body base.
      const finMaterial = new THREE.MeshStandardMaterial({ color: "#2b3a55", roughness: 0.65 });
      const finGeometry = makeFinGeometry();
      for (let i = 0; i < 4; i += 1) {
        const finMesh = new THREE.Mesh(finGeometry, finMaterial);
        finMesh.position.y = FIN_BOTTOM_Y;
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / 4) * Math.PI * 2;
        pivot.add(finMesh);
        rocketGroup.add(pivot);
        registerPart("fins", finMesh);
      }

      // Capsule, with a small window disc.
      const capsuleMaterial = new THREE.MeshStandardMaterial({ color: "#c7ccd4", roughness: 0.45, metalness: 0.2 });
      const capsule = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.62, CAPSULE_TOP_Y - CAPSULE_BOTTOM_Y, 18),
        capsuleMaterial,
      );
      capsule.position.y = (CAPSULE_BOTTOM_Y + CAPSULE_TOP_Y) / 2;
      rocketGroup.add(capsule);
      registerPart("capsule", capsule);
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: "#173049",
        roughness: 0.2,
        metalness: 0.4,
        emissive: "#0b1c2c",
        emissiveIntensity: 0.3,
      });
      const capsuleWindow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), windowMaterial);
      capsuleWindow.position.set(0, (CAPSULE_BOTTOM_Y + CAPSULE_TOP_Y) / 2, 0.6);
      rocketGroup.add(capsuleWindow);
      registerPart("capsule", capsuleWindow);

      // Nose cone.
      const noseMaterial = new THREE.MeshStandardMaterial({ color: "#f4f6fa", roughness: 0.5 });
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.58, NOSE_TOP_Y - NOSE_BOTTOM_Y, 18), noseMaterial);
      nose.position.y = (NOSE_BOTTOM_Y + NOSE_TOP_Y) / 2;
      rocketGroup.add(nose);
      registerPart("nose-cone", nose);

      // Escape tower.
      const towerMaterial = new THREE.MeshStandardMaterial({ color: "#c94b3d", roughness: 0.6 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8), towerMaterial);
      mast.position.y = TOWER_BOTTOM_Y + 0.45;
      rocketGroup.add(mast);
      registerPart("escape-tower", mast);
      const towerCap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), towerMaterial);
      towerCap.position.y = TOWER_BOTTOM_Y + 0.9 + 0.175;
      rocketGroup.add(towerCap);
      registerPart("escape-tower", towerCap);

      // --- Selection ring (billboard, precedent: EarthScene/SolarSystemScene)
      const selectionRing = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.14, 40),
        new THREE.MeshBasicMaterial({
          color: "#ffde00",
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      selectionRing.visible = false;
      scene.add(selectionRing);

      // --- Orbit-stage dashed ring ("orbit line") -----------------------------
      const orbitCurvePoints: THREE.Vector3[] = [];
      const ORBIT_RING_RADIUS = 5.5;
      for (let i = 0; i <= 64; i += 1) {
        const a = (i / 64) * Math.PI * 2;
        orbitCurvePoints.push(new THREE.Vector3(Math.cos(a) * ORBIT_RING_RADIUS, 0, Math.sin(a) * ORBIT_RING_RADIUS));
      }
      const orbitLineMaterial = new THREE.LineDashedMaterial({
        color: "#9ad6ff",
        dashSize: 0.4,
        gapSize: 0.28,
        transparent: true,
        opacity: 0,
      });
      const orbitLine = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitCurvePoints),
        orbitLineMaterial,
      );
      orbitLine.computeLineDistances();
      scene.add(orbitLine);

      // --- Shared particle texture + pools (well under the ~2,500-3,000 live
      // point budget — see the build brief's per-effect counts). -------------
      const dotTexture = createStarSpriteTexture();
      const firePool = new ParticlePool({ max: 480, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -0.5, drag: 0.3, growPortion: 0.15 });
      const smokePool = new ParticlePool({ max: 300, texture: dotTexture, blending: THREE.NormalBlending, gravity: 0.5, drag: 0.45, growPortion: 0.35 });
      const sparkPool = new ParticlePool({ max: 100, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -1.2, drag: 0.2, growPortion: 0.08 });
      const steamPool = new ParticlePool({ max: 150, texture: dotTexture, blending: THREE.NormalBlending, gravity: 0.3, drag: 0.5, growPortion: 0.3 });
      const confettiPool = new ParticlePool({ max: 220, texture: dotTexture, blending: THREE.AdditiveBlending, gravity: -1.0, drag: 0.25, growPortion: 0.12 });
      const pools = [firePool, smokePool, sparkPool, steamPool, confettiPool];
      pools.forEach((pool) => scene.add(pool.points));

      // --- Resize (writes the canvas CSS size, not just its pixel-buffer
      // attribute size — see ScienceScene/EarthScene's identical note). ------
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

      // --- Camera rig: persistent eased position/look, exponential lerp per
      // frame (ScienceScene precedent) — no orbit controls; the camera is
      // always automatically framed (overview / selected part / flight
      // chase), same "fully automatic camera" convention as ScienceScene. --
      const camPos = new THREE.Vector3(6.0, 4.6, 12.5);
      const camLook = new THREE.Vector3(0, 3.6, 0);
      const targetCamPos = new THREE.Vector3();
      const targetLook = new THREE.Vector3();

      // --- Pointer: tap-only (no drag-orbit — the camera is fully automatic,
      // same convention as ScienceScene's per-station framing). ---------------
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const tmpProject = new THREE.Vector3();
      const dragState = { active: false, moved: false, startX: 0, startY: 0, pointerId: null as number | null };

      function resolveTap(clientX: number, clientY: number): RocketPartId | null {
        const rect = renderer.domElement.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        ndc.x = (localX / rect.width) * 2 - 1;
        ndc.y = -(localY / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(raycastMeshes, false);
        if (hits.length > 0) {
          const id = meshToPart.get(hits[0].object);
          if (id) return id;
        }

        // Generous tap-radius fallback (kid-sized fingers, static camera —
        // see EarthScene/SolarSystemScene's identical resolveTap fallback).
        const threshold = 60;
        let bestId: RocketPartId | null = null;
        let bestDist = threshold;
        ROCKET_PART_ORDER.forEach((id) => {
          const meta = PART_META[id];
          tmpProject.set(0, meta.centerY + rocketGroup.position.y, 0);
          tmpProject.project(camera);
          if (tmpProject.z > 1) return;
          const sx = (tmpProject.x * 0.5 + 0.5) * rect.width;
          const sy = (-tmpProject.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - localX, sy - localY);
          if (d < bestDist) {
            bestDist = d;
            bestId = id;
          }
        });
        return bestId;
      }

      const onPointerDown = (event: PointerEvent) => {
        if (!interactiveRef.current) return;
        renderer.domElement.setPointerCapture(event.pointerId);
        dragState.active = true;
        dragState.moved = false;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        dragState.pointerId = event.pointerId;
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!dragState.active || event.pointerId !== dragState.pointerId) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) dragState.moved = true;
      };
      const endPointer = (event: PointerEvent) => {
        if (event.pointerId !== dragState.pointerId) return;
        try {
          renderer.domElement.releasePointerCapture(event.pointerId);
        } catch {
          /* pointer capture may already be released */
        }
        const wasTap = dragState.active && !dragState.moved;
        dragState.active = false;
        dragState.pointerId = null;
        if (wasTap && interactiveRef.current) {
          const id = resolveTap(event.clientX, event.clientY);
          if (id) onSelectRef.current(id);
        }
      };

      const onContextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        const message = "The rocket launchpad stopped drawing.";
        setError(message);
        onErrorRef.current?.(message);
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", endPointer);
      renderer.domElement.addEventListener("pointercancel", endPointer);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      // --- Flight state (custom physics — thrust ramp vs. gravity) ----------
      let launchStage: LaunchStage = "pad";
      let stageTime = 0;
      let thrust = 0;
      let velocityY = 0;
      let altitude = 0;
      let shakeAmp = 0;
      let skyLerp = 0;
      let ignitionFired = false;
      let liftoffFired = false;
      let skyDarkeningFired = false;
      let reachingSpaceFired = false;
      let orbitFired = false;
      let fireAccum = 0;
      let smokeAccum = 0;
      let sparkAccum = 0;
      let steamAccum = 0;
      let elapsed = 0;

      function spawnConfettiBurst() {
        const palette = ["#ff6b6b", "#ffd93d", "#63c9ff", "#4ecdc4", "#c792ea"];
        for (let i = 0; i < 110; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.2 + Math.random() * 2.2;
          confettiPool.emitTinted({
            position: new THREE.Vector3(
              rocketGroup.position.x + (Math.random() - 0.5) * 1.4,
              rocketGroup.position.y + PART_META.capsule.centerY + (Math.random() - 0.5) * 1.6,
              (Math.random() - 0.5) * 1.4,
            ),
            velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.0 + Math.random() * 1.6, Math.sin(angle) * speed),
            colorA: palette[i % palette.length],
            colorB: palette[(i + 2) % palette.length],
            peakSize: 0.18 + Math.random() * 0.12,
            endSize: 0.03,
            life: 1.4 + Math.random() * 0.8,
          });
        }
      }

      function startLaunchInternal() {
        launchStage = "ignition";
        stageTime = 0;
        thrust = 0;
        velocityY = 0;
        altitude = 0;
        shakeAmp = 0;
        ignitionFired = false;
        liftoffFired = false;
        skyDarkeningFired = false;
        reachingSpaceFired = false;
        orbitFired = false;
      }
      function resetToPadInternal() {
        launchStage = "pad";
        stageTime = 0;
        thrust = 0;
        velocityY = 0;
        altitude = 0;
        shakeAmp = 0;
        skyLerp = 0;
        rocketGroup.position.y = 0;
        ignitionFired = false;
        liftoffFired = false;
        skyDarkeningFired = false;
        reachingSpaceFired = false;
        orbitFired = false;
      }
      actionsRef.current = { startLaunch: startLaunchInternal, resetToPad: resetToPadInternal };

      function tickLaunch(delta: number) {
        // Ambient pad steam wisps, always on while grounded — part of the
        // diorama's idle life, not just a launch effect.
        if (altitude < 2) {
          steamAccum += delta * (launchStage === "ignition" ? 26 : 4);
          while (steamAccum >= 1) {
            steamAccum -= 1;
            const side = Math.random() > 0.5 ? 1 : -1;
            steamPool.emit({
              position: new THREE.Vector3(side * (1.4 + Math.random() * 0.4), 0.08, side * -(0.8 + Math.random() * 0.4)),
              velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3),
              color: new THREE.Color("#eef3f7"),
              peakSize: 0.4 + Math.random() * 0.3,
              endSize: 0.7,
              life: 1.6 + Math.random() * 0.8,
            });
          }
        }

        if (launchStage === "pad") return;
        stageTime += delta;
        engineWorldPos.set(rocketGroup.position.x, rocketGroup.position.y + ENGINE_BOTTOM_Y, rocketGroup.position.z);

        if (launchStage === "ignition") {
          thrust = Math.min(MAX_THRUST, thrust + delta * THRUST_RAMP_IGNITION);
          shakeAmp = Math.min(MAX_SHAKE, shakeAmp + delta * 1.6);
          if (!ignitionFired) {
            ignitionFired = true;
            onEventRef.current({ type: "ignition" });
          }
          if (thrust > GRAVITY_MAG) {
            launchStage = "ascend";
            stageTime = 0;
          }
        } else if (launchStage === "ascend") {
          thrust = Math.min(MAX_THRUST, thrust + delta * THRUST_RAMP_ASCEND);
          const netAccel = thrust - GRAVITY_MAG;
          velocityY += netAccel * delta;
          altitude += velocityY * delta;
          rocketGroup.position.y = altitude;
          shakeAmp = Math.min(MAX_SHAKE, shakeAmp + delta * 0.6);
          if (!liftoffFired && altitude > 0.15) {
            liftoffFired = true;
            onEventRef.current({ type: "liftoff" });
          }
          skyLerp = THREE.MathUtils.clamp(altitude / ORBIT_ALTITUDE, 0, 1);
          if (!skyDarkeningFired && skyLerp > 0.35) {
            skyDarkeningFired = true;
            onEventRef.current({ type: "sky-darkening" });
          }
          if (!reachingSpaceFired && skyLerp > 0.8) {
            reachingSpaceFired = true;
            onEventRef.current({ type: "reaching-space" });
          }
          if (altitude >= ORBIT_ALTITUDE) {
            launchStage = "orbit";
            stageTime = 0;
          }
        } else if (launchStage === "orbit") {
          thrust = THREE.MathUtils.lerp(thrust, GRAVITY_MAG * 0.98, Math.min(1, delta * 1.2));
          velocityY = THREE.MathUtils.lerp(velocityY, 0, Math.min(1, delta * 1.5));
          altitude += velocityY * delta;
          rocketGroup.position.y = altitude + Math.sin(stageTime * 0.6) * 0.05;
          shakeAmp = Math.max(0, shakeAmp - delta * 1.2);
          if (!orbitFired && stageTime > 0.6) {
            orbitFired = true;
            spawnConfettiBurst();
            onEventRef.current({ type: "orbit" });
          }
        }

        // Fire: heavy while thrust is building/holding, trickles off in orbit.
        const fireRate = launchStage === "orbit" ? Math.max(0, 60 * (1 - stageTime)) : 70 + thrust * 12;
        fireAccum += delta * fireRate;
        while (fireAccum >= 1) {
          fireAccum -= 1;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.3;
          firePool.emit({
            position: new THREE.Vector3(engineWorldPos.x + Math.cos(a) * r, engineWorldPos.y - 0.1, engineWorldPos.z + Math.sin(a) * r),
            velocity: new THREE.Vector3(Math.cos(a) * 0.5, -(1.6 + Math.random() * 1.2), Math.sin(a) * 0.5),
            color: new THREE.Color().setHSL(0.03 + Math.random() * 0.09, 1, 0.55 + Math.random() * 0.15),
            peakSize: 0.5 + Math.random() * 0.35,
            endSize: 0.05,
            life: 0.4 + Math.random() * 0.25,
          });
        }
        if (launchStage === "ignition" || (launchStage === "ascend" && stageTime < 0.6)) {
          sparkAccum += delta * 18;
          while (sparkAccum >= 1) {
            sparkAccum -= 1;
            sparkPool.emit({
              position: new THREE.Vector3(engineWorldPos.x + (Math.random() - 0.5) * 0.6, engineWorldPos.y, engineWorldPos.z + (Math.random() - 0.5) * 0.6),
              velocity: new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6),
              color: new THREE.Color("#ffe27a"),
              peakSize: 0.13,
              endSize: 0.02,
              life: 0.5 + Math.random() * 0.4,
            });
          }
        }
        // Ground-hugging launch smoke — only billows near the pad, same as a
        // real launch cloud (doesn't chase the rocket to orbit).
        if (altitude < 4) {
          smokeAccum += delta * (launchStage === "ignition" ? 55 : 30);
          while (smokeAccum >= 1) {
            smokeAccum -= 1;
            smokePool.emit({
              position: new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.15, (Math.random() - 0.5) * 1.6 - 0.4),
              velocity: new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.9),
              color: new THREE.Color("#c9cfd4"),
              peakSize: 0.6 + Math.random() * 0.4,
              endSize: 0.9,
              life: 1.6 + Math.random() * 0.8,
            });
          }
        }
      }

      // --- Animation loop -----------------------------------------------------
      const clock = new THREE.Clock();
      const highlight: Record<RocketPartId, { value: number; velocity: number }> = {
        "escape-tower": { value: 0, velocity: 0 },
        "nose-cone": { value: 0, velocity: 0 },
        capsule: { value: 0, velocity: 0 },
        fins: { value: 0, velocity: 0 },
        "fuel-tank": { value: 0, velocity: 0 },
        engines: { value: 0, velocity: 0 },
      };
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.1);
        elapsed += delta;

        tickLaunch(delta);
        pools.forEach((pool) => pool.update(delta));

        // Sky lerp + fog reach-out (so haze doesn't wash out the stars).
        (scene.background as THREE.Color).copy(skyDay).lerp(skySpace, skyLerp);
        if (scene.fog) {
          (scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
          (scene.fog as THREE.Fog).near = THREE.MathUtils.lerp(20, 240, skyLerp);
          (scene.fog as THREE.Fog).far = THREE.MathUtils.lerp(55, 480, skyLerp);
        }
        starLayers.forEach(({ material, baseOpacity }) => {
          material.opacity = baseOpacity * skyLerp;
        });
        starGroup.rotation.y += delta * STAR_SPIN_RATE;

        clouds.forEach((sprite, i) => {
          sprite.position.x = cloudBaseX[i] + Math.sin(elapsed * 0.05 + i) * 1.4;
          (sprite.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - skyLerp);
        });

        // Orbit-line ring: fades in only during "orbit", tracks the rocket.
        orbitLine.position.y = rocketGroup.position.y;
        orbitLineMaterial.opacity +=
          ((launchStage === "orbit" ? 0.55 : 0) - orbitLineMaterial.opacity) * Math.min(1, delta * 2);
        orbitLine.rotation.y += delta * 0.15;

        // Part highlight springs (tap-pop) — only live while interactive.
        const activeSelection = interactiveRef.current ? selectedPartRef.current : null;
        ROCKET_PART_ORDER.forEach((id) => {
          const spring = highlight[id];
          const target = activeSelection === id ? 1 : 0;
          const result = springTo(spring.value, spring.velocity, target, delta, 150, 16);
          spring.value = THREE.MathUtils.clamp(result.value, 0, 1.3);
          spring.velocity = result.velocity;
          partMeshes[id].forEach((mesh) => {
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.emissive.copy(HIGHLIGHT_COLOR);
            material.emissiveIntensity = spring.value;
          });
        });
        // Ignition glow overrides the engines' highlight when thrust is live.
        const thrustGlow = launchStage === "pad" ? 0 : Math.min(1.4, (thrust / MAX_THRUST) * 1.4);
        if (thrustGlow > highlight.engines.value) {
          engineMaterial.emissive.copy(IGNITION_GLOW_COLOR);
          engineMaterial.emissiveIntensity = thrustGlow;
        }

        // Selection ring billboard.
        if (activeSelection) {
          const meta = PART_META[activeSelection];
          selectionRing.visible = true;
          selectionRing.position.set(0, meta.centerY + rocketGroup.position.y, meta.reach * 0.6 + 0.1);
          selectionRing.scale.setScalar(Math.max(meta.reach * 1.5, 0.5));
          selectionRing.quaternion.copy(camera.quaternion);
        } else {
          selectionRing.visible = false;
        }

        // Camera targeting.
        if (launchStage === "pad" && activeSelection) {
          const meta = PART_META[activeSelection];
          targetLook.set(0, meta.centerY, 0);
          targetCamPos.set(4.6, meta.centerY + 1.1, 6.2);
        } else if (launchStage === "pad") {
          targetLook.set(0, 3.6, 0);
          targetCamPos.set(6.0, 4.6, 12.5);
        } else {
          const rocketY = rocketGroup.position.y;
          targetLook.set(0, rocketY + 3.2, 0);
          targetCamPos.set(7.5, rocketY + 4.2, 10.8);
        }
        const lerpAlpha = Math.min(1, delta * (launchStage === "pad" ? 2.6 : 1.8));
        camPos.x += (targetCamPos.x - camPos.x) * lerpAlpha;
        camPos.y += (targetCamPos.y - camPos.y) * lerpAlpha;
        camPos.z += (targetCamPos.z - camPos.z) * lerpAlpha;
        camLook.x += (targetLook.x - camLook.x) * lerpAlpha;
        camLook.y += (targetLook.y - camLook.y) * lerpAlpha;
        camLook.z += (targetLook.z - camLook.z) * lerpAlpha;
        camera.position.copy(camPos);
        if (shakeAmp > 0.001) {
          camera.position.x += (Math.random() - 0.5) * shakeAmp;
          camera.position.y += (Math.random() - 0.5) * shakeAmp * 0.6;
          camera.position.z += (Math.random() - 0.5) * shakeAmp * 0.4;
        }
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
        // Particle pools' ShaderMaterial uses a custom uniforms.map (not the
        // conventional `.map` property disposeObject3D's generic traversal
        // knows how to find), and the sprite texture is shared across every
        // pool — dispose it once, here, after each pool's own geometry has
        // already been swept by disposeObject3D (ScienceScene precedent).
        dotTexture.dispose();
        renderer.dispose();
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
                Rocket Launch needs 3D graphics
              </p>
              <p className="mt-2 text-lg font-bold text-slate-600">
                {error} The part and launch buttons below still work.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
