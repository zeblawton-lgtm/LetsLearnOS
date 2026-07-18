// ---------------------------------------------------------------------------
// Reusable 3D Earth renderer (WebGL / three.js) for the Geography page — the
// Earth-sized sibling of components/SolarSystemScene.tsx. Copies that
// component's lifecycle discipline and camera/pointer "physics" wholesale
// (capped device pixel ratio, ResizeObserver-driven resize, direct 1:1
// drag-to-orbit with no post-release inertia, pinch-to-zoom, an exponential
// lerp for all camera easing, and full geometry/material/texture disposal on
// unmount) but adapts the camera rig for a single fixed sphere with points of
// interest on its surface instead of multiple orbiting bodies — see the
// camera rig comment below for how "fly the camera to a continent" works
// when there's only one body that never leaves the origin.
//
// Coastlines are the real world-land.ts polygons (Natural Earth 110m, public
// domain), painted onto one big equirectangular canvas texture exactly like
// the previous inline version of this globe in pages/geography.tsx used to.
// Also keeps that file's kiosk hardening (webglcontextlost handler,
// forceContextLoss on cleanup), which SolarSystemScene now mirrors too.
// ---------------------------------------------------------------------------
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { continents, type ContinentFact } from "@/content/world-globe";
import { LAND_POLYGONS, type LandRing } from "@/content/world-land";
import {
  createGlowTexture,
  createStarfieldGeometry,
  createStarSpriteTexture,
} from "@/lib/space-textures";

export interface EarthHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface EarthSceneProps {
  /** Currently selected continent id — drives the camera fly-to + highlight. */
  selectedId: string;
  /** Fired when the child taps a continent. Parent owns playTap/TTS so every
   * entry point (3D tap, picker row) narrates exactly once. */
  onSelectContinent: (id: string) => void;
  /** Fired when the 3D scene fails to start or loses its WebGL context, so
   * the parent can narrate the fallback for pre-readers (a toddler can't
   * read why the globe went away). Null once — never called again to clear
   * it, since a lost WebGL context doesn't come back on its own. */
  onError?: (message: string) => void;
  className?: string;
}

const GLOBE_RADIUS = 2.0;
// Matches the tuned values from the previous inline globe (ZOOM_DEFAULT /
// ZOOM_MIN) so the "how big does Earth look" feel doesn't regress just
// because the render path moved — this file can't be visually verified on a
// real display, so known-good constants beat fresh guesses.
const OVERVIEW_DISTANCE = 5.8;
const FOCUS_DISTANCE = 3.4;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;
const DIST_MIN = 2.1;
const DIST_MAX = OVERVIEW_DISTANCE * 2.0;
// Earth keeps gently turning on its own axis at all times (mirrors
// SolarSystemScene: planets keep orbiting even while one of them is
// selected) — the camera "flies to" a continent by countering this spin, a
// nice satellite-lock feel once it catches up.
const EARTH_SPIN_RATE = 0.035; // rad/s
const STAR_SPIN_RATE = 0.0015; // rad/s, same as SolarSystemScene's starfield
// A 3-year-old's tap wobbles well past a few pixels; SolarSystemScene uses a
// 3px slop (fine for a mouse-oriented desktop demo) but geography.tsx's
// existing globe already learned the hard way that toddlers need ~12px.
const TAP_SLOP = 12;

const ORIGIN = new THREE.Vector3(0, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Roughly how far each continent's landmass reaches from its centroid, in
// world units on the GLOBE_RADIUS=2.0 sphere. Eyeballed from the real
// coastlines, not measured — good enough to size a highlight glow, not
// precise enough to be a coastline-accurate boundary (see the tap-resolution
// comment further down for why exact per-continent boundaries aren't
// available from this dataset).
const CONTINENT_REACH: Record<string, number> = {
  "north-america": 1.05,
  "south-america": 0.85,
  europe: 0.55,
  africa: 0.95,
  asia: 1.15,
  australia: 0.85,
  antarctica: 0.9,
};

interface ContinentMarker {
  continent: ContinentFact;
  group: THREE.Group;
  ring: THREE.Mesh;
  glow: THREE.Mesh;
}

function latLngToVector(lat: number, lng: number, radius = GLOBE_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Inverse of latLngToVector — recovers lat/lng (degrees) from a direction.
function vectorToLatLng(vector: THREE.Vector3): { lat: number; lng: number } {
  const n = vector.clone().normalize();
  const lat =
    90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)));
  let lng = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  if (lng < -180) lng += 360;
  return { lat, lng };
}

function mapPoint(lng: number, lat: number, width: number, height: number) {
  return {
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

function lerpAngle(current: number, target: number, t: number) {
  const twoPi = Math.PI * 2;
  let delta = (target - current) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return current + delta * t;
}

// One land mass = outer ring + optional hole rings (even-odd fill).
// Antarctica renders as ice; everything else as land green.
function drawLandPolygon(ctx: CanvasRenderingContext2D, rings: LandRing[]) {
  if (rings.length === 0 || rings[0].length === 0) return;
  const { width, height } = ctx.canvas;
  const path = new Path2D();
  for (const ring of rings) {
    ring.forEach(([lng, lat], i) => {
      const point = mapPoint(lng, lat, width, height);
      if (i === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });
    path.closePath();
  }
  const isAntarctica = rings[0].every(([, lat]) => lat < -59);
  ctx.fillStyle = isAntarctica ? "#eef7fb" : "#58c878";
  ctx.fill(path, "evenodd");
  ctx.lineWidth = 5;
  ctx.strokeStyle = isAntarctica
    ? "rgba(148, 190, 214, 0.6)"
    : "rgba(21, 94, 67, 0.55)";
  ctx.stroke(path);
}

function makeGlobeTexture() {
  const canvas = document.createElement("canvas");
  // 4096px keeps coastlines crisp at the closest pinch-zoom level.
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#0e3a66");
  ocean.addColorStop(0.42, "#155a9c");
  ocean.addColorStop(1, "#0c3660");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = mapPoint(0, lat, canvas.width, canvas.height).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let lng = -150; lng <= 150; lng += 30) {
    const x = mapPoint(lng, 0, canvas.width, canvas.height).x;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;

  LAND_POLYGONS.forEach((rings) => drawLandPolygon(ctx, rings));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Ray-casting point-in-ring test (even-odd), operating in the same [lng,lat]
// ordering as LAND_POLYGONS.
function pointInRing(lng: number, lat: number, ring: LandRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Point-in-polygon over the real coastlines, honouring holes via even-odd
// (XOR-ing each ring's parity is mathematically equivalent to one combined
// crossing count over every ring). This can only answer "is this land or
// ocean" — it CANNOT tell us which continent, because the underlying
// Natural Earth 110m data merges physically-connected landmasses into single
// polygons (Africa+Europe+Asia share one polygon via the Sinai land bridge;
// North+South America share one via the Panama isthmus). Continent
// assignment below always falls back to nearest-centroid.
function isLandPoint(lat: number, lng: number): boolean {
  for (const rings of LAND_POLYGONS) {
    let inside = false;
    for (const ring of rings) {
      if (pointInRing(lng, lat, ring)) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

// Nearest-continent-centroid classification (Voronoi-by-center over the 7
// continent lat/lngs in world-globe.ts). This is the only way to assign a
// continent id with the data on hand — see isLandPoint's comment. `vector`
// must already be in the Earth group's local (unrotated) space.
function nearestContinent(
  vector: THREE.Vector3,
  maxAngle: number,
): ContinentFact | undefined {
  const normalized = vector.clone().normalize();
  let best: ContinentFact | undefined;
  let bestAngle = Number.POSITIVE_INFINITY;
  for (const continent of continents) {
    const center = latLngToVector(continent.lat, continent.lng, 1).normalize();
    const angle = normalized.angleTo(center);
    if (angle < bestAngle) {
      best = continent;
      bestAngle = angle;
    }
  }
  return bestAngle < maxAngle ? best : undefined;
}

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

export const EarthScene = forwardRef<EarthHandle, EarthSceneProps>(
  function EarthScene(
    { selectedId, onSelectContinent, onError, className },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const selectedIdRef = useRef(selectedId);
    const zoomFactorRef = useRef(1);
    const onSelectRef = useRef(onSelectContinent);
    const onErrorRef = useRef(onError);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      selectedIdRef.current = selectedId;
    }, [selectedId]);

    useEffect(() => {
      onSelectRef.current = onSelectContinent;
    }, [onSelectContinent]);

    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          zoomFactorRef.current = THREE.MathUtils.clamp(
            zoomFactorRef.current * 0.8,
            MIN_ZOOM,
            MAX_ZOOM,
          );
        },
        zoomOut: () => {
          zoomFactorRef.current = THREE.MathUtils.clamp(
            zoomFactorRef.current * 1.25,
            MIN_ZOOM,
            MAX_ZOOM,
          );
        },
      }),
      [],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; scene lives for the component's lifetime
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x03040c);

      // far=200 (not SolarSystemScene's 400) still comfortably covers the
      // farthest starfield shell (radius 140) with headroom.
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        setError(null);
      } catch (err) {
        console.error("Unable to start the Earth scene.", err);
        const message = "This device could not start the 3D globe.";
        setError(message);
        onErrorRef.current?.(message);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.touchAction = "none";
      mount.appendChild(renderer.domElement);

      // --- Starfield (identical layering to SolarSystemScene) -------------
      const starGroup = new THREE.Group();
      const starSprite = createStarSpriteTexture();
      [
        { count: 2600, radius: 140, size: 0.55, opacity: 0.55, colors: ["#ffffff", "#cfe3ff"] },
        { count: 1200, radius: 100, size: 0.95, opacity: 0.75, colors: ["#ffffff", "#dce8ff", "#fff3d6"] },
        { count: 380, radius: 70, size: 1.6, opacity: 0.9, colors: ["#ffffff", "#ffe9b0"] },
      ].forEach((layer) => {
        const geometry = createStarfieldGeometry(layer);
        const material = new THREE.PointsMaterial({
          size: layer.size,
          map: starSprite,
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false,
          vertexColors: true,
          sizeAttenuation: true,
        });
        starGroup.add(new THREE.Points(geometry, material));
      });
      scene.add(starGroup);

      // --- Lighting ----------------------------------------------------------
      scene.add(new THREE.HemisphereLight("#dfe7ff", "#0a0a18", 0.6));
      const sun = new THREE.DirectionalLight("#fff2d0", 2.4);
      sun.position.set(4, 5, 6);
      scene.add(sun);

      // --- Earth (real coastlines painted on one equirectangular texture) ---
      const earthGroup = new THREE.Group();
      earthGroup.rotation.y = -0.5;
      scene.add(earthGroup);

      const globeTexture = makeGlobeTexture();
      const earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
        new THREE.MeshStandardMaterial({
          map: globeTexture,
          roughness: 0.85,
          metalness: 0.02,
        }),
      );
      earthGroup.add(earthMesh);

      // Fresnel rim-light shell — a cheap, offline, no-texture "atmosphere
      // glow" (same additive-glow-fakes-bloom idea as the Sun's sprite
      // layers in SolarSystemScene, done as a shader shell instead since an
      // atmosphere needs to hug the sphere's silhouette from every angle).
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 64, 48),
        new THREE.ShaderMaterial({
          uniforms: { glowColor: { value: new THREE.Color("#8ecdff") } },
          vertexShader: `
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vNormal;
            uniform vec3 glowColor;
            void main() {
              float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
              gl_FragColor = vec4(glowColor, clamp(intensity, 0.0, 1.0));
            }
          `,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      scene.add(atmosphere);

      const gridMaterial = new THREE.LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.2,
      });
      [-60, -30, 0, 30, 60].forEach((lat) => {
        const points: THREE.Vector3[] = [];
        for (let lng = -180; lng <= 180; lng += 4) {
          points.push(latLngToVector(lat, lng, GLOBE_RADIUS + 0.01));
        }
        earthGroup.add(
          new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMaterial),
        );
      });
      [-120, -60, 0, 60, 120].forEach((lng) => {
        const points: THREE.Vector3[] = [];
        for (let lat = -84; lat <= 84; lat += 4) {
          points.push(latLngToVector(lat, lng, GLOBE_RADIUS + 0.01));
        }
        earthGroup.add(
          new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMaterial),
        );
      });

      // --- Continent markers: ring outline (always visible) + soft glow
      // disc (only visible once selected — the "highlight" a tap gives). ---
      const markers: ContinentMarker[] = [];
      const markerById = new Map<string, ContinentMarker>();
      continents.forEach((continent) => {
        const normal = latLngToVector(continent.lat, continent.lng, 1).normalize();
        const group = new THREE.Group();
        group.position.copy(normal.clone().multiplyScalar(GLOBE_RADIUS));
        group.quaternion.setFromUnitVectors(Z_AXIS, normal);
        earthGroup.add(group);

        const reach = CONTINENT_REACH[continent.id] ?? 0.8;
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(reach, 48),
          new THREE.MeshBasicMaterial({
            map: createGlowTexture(continent.color),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        glow.position.set(0, 0, 0.025);
        group.add(glow);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.105, 0.014, 8, 42),
          new THREE.MeshBasicMaterial({
            color: continent.color,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          }),
        );
        ring.position.set(0, 0, 0.05);
        group.add(ring);

        const marker: ContinentMarker = { continent, group, ring, glow };
        markers.push(marker);
        markerById.set(continent.id, marker);
      });

      // --- Resize (writes the canvas CSS size, not just its pixel-buffer
      // attribute size — with pixelRatio 2 on the kiosk's 200% scaling, the
      // attribute size doubles and would otherwise become the layout size
      // and overflow the stage; see geography.tsx's PAGE_HEIGHT note). -----
      const resize = () => {
        const { clientWidth, clientHeight } = mount;
        if (clientWidth === 0 || clientHeight === 0) return;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      // --- Camera rig -----------------------------------------------------
      // SolarSystemScene orbits a spherical camera (yaw/pitch/distance)
      // around a *lerped focus position* that can be any orbiting body.
      // Earth never moves — there's only one body, always at the origin —
      // so "fly the camera to a continent" instead means driving yaw/pitch
      // toward the angle that puts that continent's (possibly still-turning)
      // surface point directly in front of the camera. currentDistance is
      // still eased the same way SolarSystemScene eases its focus distance.
      let yaw = 0.6;
      let pitch = 0.22;
      let currentDistance = OVERVIEW_DISTANCE;
      let prevFocusId: string | null = null;
      const tmpVec = new THREE.Vector3();

      // --- Pointer interaction: drag to orbit, pinch to zoom, tap to select
      const pointers = new Map<number, { x: number; y: number }>();
      const dragState = { active: false, moved: false, lastX: 0, lastY: 0 };
      let pinchStartDist: number | null = null;
      let pinchStartZoom = 1;
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();

      function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      // Raycast the globe -> Earth-local hit point -> lat/lng -> continent.
      // Point-in-polygon confirms land vs ocean (isLandPoint); a land hit
      // gets a generous nearest-centroid radius so real coastline taps
      // almost always resolve, while an ocean hit only resolves within a
      // tighter radius so a mid-ocean tap doesn't silently jump to a random
      // "closest" continent far away. A miss on the sphere falls back to
      // SolarSystemScene's screen-space nearest-marker trick.
      function resolveTap(clientX: number, clientY: number): string | null {
        const rect = renderer.domElement.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        ndc.x = (localX / rect.width) * 2 - 1;
        ndc.y = -(localY / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(earthMesh, false)[0];
        if (hit) {
          const local = hit.point.clone();
          earthGroup.worldToLocal(local);
          const { lat, lng } = vectorToLatLng(local);
          const onLand = isLandPoint(lat, lng);
          const match = nearestContinent(local, onLand ? 1.05 : 0.42);
          if (match) return match.id;
        }

        // Generous tap radius fallback for a missed sphere (near the
        // silhouette edge) — nearest continent marker within a comfortable
        // finger-sized threshold, mirroring SolarSystemScene's resolveTap.
        const threshold = 56;
        let bestId: string | null = null;
        let bestDist = threshold;
        markers.forEach(({ continent, group }) => {
          group.getWorldPosition(tmpVec);
          const projected = tmpVec.clone().project(camera);
          if (projected.z > 1) return;
          const sx = (projected.x * 0.5 + 0.5) * rect.width;
          const sy = (-projected.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - localX, sy - localY);
          if (d < bestDist) {
            bestDist = d;
            bestId = continent.id;
          }
        });
        return bestId;
      }

      const onPointerDown = (event: PointerEvent) => {
        renderer.domElement.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 1) {
          dragState.active = true;
          dragState.moved = false;
          dragState.lastX = event.clientX;
          dragState.lastY = event.clientY;
          pinchStartDist = null;
        } else if (pointers.size === 2) {
          dragState.active = false;
          const [a, b] = [...pointers.values()];
          pinchStartDist = pointerDistance(a, b);
          pinchStartZoom = zoomFactorRef.current;
        }
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.size === 1 && dragState.active) {
          const dx = event.clientX - dragState.lastX;
          const dy = event.clientY - dragState.lastY;
          if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) dragState.moved = true;
          yaw -= dx * 0.0055;
          pitch = THREE.MathUtils.clamp(pitch + dy * 0.0045, -1.2, 1.3);
          dragState.lastX = event.clientX;
          dragState.lastY = event.clientY;
        } else if (pointers.size === 2 && pinchStartDist) {
          const [a, b] = [...pointers.values()];
          const dist = pointerDistance(a, b);
          const ratio = dist / pinchStartDist;
          zoomFactorRef.current = THREE.MathUtils.clamp(
            pinchStartZoom / ratio,
            MIN_ZOOM,
            MAX_ZOOM,
          );
        }
      };

      const endPointer = (event: PointerEvent) => {
        const wasSingleTap =
          pointers.size === 1 && dragState.active && !dragState.moved;
        const tapX = event.clientX;
        const tapY = event.clientY;
        try {
          renderer.domElement.releasePointerCapture(event.pointerId);
        } catch {
          /* pointer capture may already be released */
        }
        pointers.delete(event.pointerId);

        if (wasSingleTap) {
          const id = resolveTap(tapX, tapY);
          if (id) onSelectRef.current(id);
        }

        if (pointers.size === 0) {
          dragState.active = false;
          pinchStartDist = null;
        } else if (pointers.size === 1) {
          const [remaining] = [...pointers.values()];
          dragState.active = true;
          dragState.moved = true; // continuing a pinch shouldn't register as a fresh tap
          dragState.lastX = remaining.x;
          dragState.lastY = remaining.y;
          pinchStartDist = null;
        }
      };

      // Days-long kiosk sessions can lose the WebGL context (driver reset);
      // swap the frozen canvas for the narrated fallback card instead of a
      // dead page (SolarSystemScene doesn't handle this — geography.tsx's
      // previous inline globe did, and a kiosk-facing sibling should too).
      const onContextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        const message = "The 3D globe stopped drawing.";
        setError(message);
        onErrorRef.current?.(message);
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", endPointer);
      renderer.domElement.addEventListener("pointercancel", endPointer);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      // --- Animation loop ---------------------------------------------------
      const clock = new THREE.Clock();
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.1);

        // Earth keeps gently turning on its own axis, always — like planets
        // that keep orbiting in SolarSystemScene even while one is focused.
        earthGroup.rotation.y += delta * EARTH_SPIN_RATE;
        starGroup.rotation.y += delta * STAR_SPIN_RATE;

        const focusId = selectedIdRef.current;
        if (focusId !== prevFocusId) {
          zoomFactorRef.current = 1;
          prevFocusId = focusId;
        }
        const focused = markerById.get(focusId);

        const desiredDistance = focused ? FOCUS_DISTANCE : OVERVIEW_DISTANCE;
        const targetDistance = desiredDistance * zoomFactorRef.current;
        const lerpAlpha = Math.min(1, delta * 3.2);
        currentDistance += (targetDistance - currentDistance) * lerpAlpha;

        // Only auto-align the camera when the child isn't actively
        // dragging, so a manual look-around is never fought — it gently
        // glides back to center the continent once they let go.
        if (!dragState.active && focused) {
          focused.group.getWorldPosition(tmpVec);
          const normal = tmpVec.normalize();
          const targetPitch = Math.asin(THREE.MathUtils.clamp(normal.y, -1, 1));
          const targetYaw = Math.atan2(normal.x, normal.z);
          yaw = lerpAngle(yaw, targetYaw, lerpAlpha);
          pitch = THREE.MathUtils.lerp(pitch, targetPitch, lerpAlpha);
        }

        const clampedDistance = THREE.MathUtils.clamp(
          currentDistance,
          DIST_MIN,
          DIST_MAX,
        );
        camera.position.set(
          clampedDistance * Math.cos(pitch) * Math.sin(yaw),
          clampedDistance * Math.sin(pitch),
          clampedDistance * Math.cos(pitch) * Math.cos(yaw),
        );
        camera.lookAt(ORIGIN);

        markers.forEach(({ continent, ring, glow }) => {
          const active = continent.id === focusId;
          const ringMaterial = ring.material as THREE.MeshBasicMaterial;
          const glowMaterial = glow.material as THREE.MeshBasicMaterial;
          ring.scale.setScalar(active ? 1.45 : 1);
          ringMaterial.opacity = active ? 0.95 : 0.55;
          glowMaterial.opacity = active ? 0.5 : 0;
        });

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
        renderer.dispose();
        // Browsers cap live WebGL contexts; without a forced release the
        // old context lingers until GC and days of page hops brick the
        // kiosk (geography.tsx's previous globe already learned this).
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
                Globe needs 3D graphics
              </p>
              <p className="mt-2 text-lg font-bold text-slate-600">
                {error} The country and state facts still work in the panel.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
