// ---------------------------------------------------------------------------
// Reusable 3D solar-system renderer (WebGL / three.js) shared by the Space
// page (Sun + 8 planets) and the Dwarf Planets page (5 dwarfs around a
// distant, decorative beacon). Follows the same lifecycle discipline as
// src/pages/geography.tsx: scene/renderer created once on mount, capped
// device pixel ratio, ResizeObserver-driven resize, pointer-event based
// drag/tap (with pinch-to-zoom added), and full geometry/material/texture
// disposal on unmount (ADR-014).
// ---------------------------------------------------------------------------
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import type { CelestialBody } from "@/content/space";
import {
  createGlowTexture,
  createPlanetTexture,
  createRingTexture,
  createStarfieldGeometry,
  createStarSpriteTexture,
  createSunTexture,
} from "@/lib/space-textures";

export interface SolarSystemHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface SolarSystemSceneProps {
  /** Orbiting bodies (planets, or dwarf planets) — never includes the star. */
  bodies: CelestialBody[];
  /** The tappable central star. Omit for a purely decorative center light. */
  star?: CelestialBody;
  /** Currently selected body id (drives camera fly-to + highlight ring). */
  selectedId: string | null;
  /** Fired when the child taps a body, or null when a caller resets view. */
  onSelectBody: (id: string | null) => void;
  /** Camera distance that frames the whole system at rest. */
  overviewDistance: number;
  className?: string;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.4;
const ORIGIN = new THREE.Vector3(0, 0, 0);

interface BodyRuntime {
  id: string;
  radius: number;
  orbitPeriod: number;
  spinPeriod: number;
  angle: number;
  orbitPivot: THREE.Group | null;
  spinMesh: THREE.Mesh;
}

function distanceForRadius(radius: number, isStar: boolean) {
  const base = isStar ? radius * 3.2 + 2.4 : radius * 6.4 + 1.3;
  return Math.max(base, 2.0);
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
      const withMap = material as unknown as {
        map?: THREE.Texture | null;
      };
      withMap.map?.dispose();
      material.dispose();
    });
  });
}

export const SolarSystemScene = forwardRef<
  SolarSystemHandle,
  SolarSystemSceneProps
>(function SolarSystemScene(
  { bodies, star, selectedId, onSelectBody, overviewDistance, className },
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const zoomFactorRef = useRef(1);
  const onSelectRef = useRef(onSelectBody);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    onSelectRef.current = onSelectBody;
  }, [onSelectBody]);

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
      resetView: () => {
        onSelectRef.current(null);
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

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      setError(null);
    } catch (err) {
      console.error("Unable to start the space scene.", err);
      setError("This device could not start the 3D scene.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // --- Starfield ---------------------------------------------------------
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

    // --- Ambient + star lighting --------------------------------------------
    scene.add(new THREE.HemisphereLight("#dfe7ff", "#0a0a18", 0.55));
    const centerLight = new THREE.PointLight(
      "#fff2d0",
      star ? 5.5 : 2.2,
      0,
      1.6,
    );
    scene.add(centerLight);

    // --- Bodies --------------------------------------------------------------
    const bodyRefs = new Map<string, BodyRuntime>();
    const raycastMeshes: THREE.Object3D[] = [];
    const meshToId = new Map<THREE.Object3D, string>();
    const orbitLineMaterial = new THREE.LineBasicMaterial({
      color: "#7ea1ff",
      transparent: true,
      opacity: 0.16,
    });

    function makeOrbitRing(radius: number) {
      const points: THREE.Vector3[] = [];
      const segments = 96;
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineLoop(geometry, orbitLineMaterial);
    }

    function addBody(body: CelestialBody, isStar: boolean) {
      const segments = isStar ? 48 : 32;
      const texture = isStar
        ? createSunTexture(body.colors)
        : createPlanetTexture(body.id, body.colors, body.radius < 0.2 ? "low" : "high");
      const material = isStar
        ? new THREE.MeshBasicMaterial({ map: texture })
        : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0.04 });
      const spinMesh = new THREE.Mesh(
        new THREE.SphereGeometry(body.radius, segments, Math.round(segments * 0.7)),
        material,
      );
      if (body.squashed) spinMesh.scale.set(1.4, 0.72, 1.08);

      let orbitPivot: THREE.Group | null = null;
      if (isStar) {
        scene.add(spinMesh);

        // Layered additive glow sprites fake a bloom around the Sun.
        [
          { scale: body.radius * 4.4, color: "#ffe08a", opacity: 0.55 },
          { scale: body.radius * 7.2, color: "#ffb347", opacity: 0.32 },
          { scale: body.radius * 11, color: "#ff8c3a", opacity: 0.16 },
        ].forEach((layer) => {
          const glowTexture = createGlowTexture(layer.color);
          const spriteMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            transparent: true,
            opacity: layer.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.scale.set(layer.scale, layer.scale, 1);
          scene.add(sprite);
        });
      } else {
        orbitPivot = new THREE.Group();
        orbitPivot.rotation.y = Math.random() * Math.PI * 2;
        scene.add(makeOrbitRing(body.orbitRadius));

        const tiltPivot = new THREE.Group();
        tiltPivot.position.set(body.orbitRadius, 0, 0);
        tiltPivot.rotation.z = THREE.MathUtils.degToRad(body.axialTilt);
        tiltPivot.add(spinMesh);

        if (body.hasRing) {
          const ringTexture = createRingTexture(body.colors);
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(body.radius * 1.5, body.radius * 2.5, 64),
            new THREE.MeshBasicMaterial({
              map: ringTexture,
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false,
              opacity: 0.9,
            }),
          );
          ring.rotation.x = Math.PI / 2;
          tiltPivot.add(ring);
        }

        orbitPivot.add(tiltPivot);
        scene.add(orbitPivot);
      }

      bodyRefs.set(body.id, {
        id: body.id,
        radius: body.radius,
        orbitPeriod: body.orbitPeriod,
        spinPeriod: body.spinPeriod,
        angle: orbitPivot ? orbitPivot.rotation.y : 0,
        orbitPivot,
        spinMesh,
      });
      raycastMeshes.push(spinMesh);
      meshToId.set(spinMesh, body.id);
    }

    if (star) addBody(star, true);
    bodies.forEach((body) => addBody(body, false));

    // Decorative, non-tappable beacon when there's no real star (dwarf view).
    if (!star) {
      const beaconTexture = createGlowTexture("#ffe9b0");
      const beaconMaterial = new THREE.SpriteMaterial({
        map: beaconTexture,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const beacon = new THREE.Sprite(beaconMaterial);
      beacon.scale.set(1.6, 1.6, 1);
      scene.add(beacon);
    }

    // Billboard selection ring that hovers over the selected body.
    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.12, 40),
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

    // --- Resize --------------------------------------------------------------
    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (clientWidth === 0 || clientHeight === 0) return;
      // Let setSize also write the canvas CSS size: with pixelRatio 2 (the
      // kiosk runs at 200% scaling) the attribute size is doubled and would
      // otherwise become the layout size, overflowing the stage and pushing
      // the visual center (where the camera looks) off to the bottom-right.
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    // --- Camera rig (spherical orbit around a smoothly-lerped focus) --------
    let yaw = 0.5;
    let pitch = 0.32;
    let currentDistance = overviewDistance;
    const currentFocus = new THREE.Vector3(0, 0, 0);
    const tmpFocus = new THREE.Vector3();
    let prevFocusId: string | null = null;

    // --- Pointer interaction: drag to orbit, pinch to zoom, tap to select --
    const pointers = new Map<number, { x: number; y: number }>();
    const dragState = { active: false, moved: false, lastX: 0, lastY: 0 };
    let pinchStartDist: number | null = null;
    let pinchStartZoom = 1;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function resolveTap(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      ndc.x = (localX / rect.width) * 2 - 1;
      ndc.y = -(localY / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(raycastMeshes, false);
      if (hits.length > 0) {
        const id = meshToId.get(hits[0].object);
        if (id) return id;
      }

      // Generous tap radius fallback: pick the nearest body's screen
      // position within a comfortable finger-sized threshold, so small,
      // distant planets stay reachable without pixel-precise taps.
      const threshold = 46;
      let bestId: string | null = null;
      let bestDist = threshold;
      bodyRefs.forEach((body, id) => {
        body.spinMesh.getWorldPosition(tmpFocus);
        const projected = tmpFocus.clone().project(camera);
        if (projected.z > 1) return; // behind camera
        const sx = (projected.x * 0.5 + 0.5) * rect.width;
        const sy = (-projected.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - localX, sy - localY);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
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
        if (Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
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
      const wasSingleTap = pointers.size === 1 && dragState.active && !dragState.moved;
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
        // Sound + narration are owned by the parent page so every selection
        // entry point (3D tap, picker row) plays the tap cue exactly once.
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

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setError("The 3D scene stopped drawing.");
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", endPointer);
    renderer.domElement.addEventListener("pointercancel", endPointer);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    // --- Animation loop -------------------------------------------------------
    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      bodyRefs.forEach((body) => {
        if (body.orbitPivot && body.orbitPeriod > 0) {
          body.angle += ((Math.PI * 2) / body.orbitPeriod) * delta;
          body.orbitPivot.rotation.y = body.angle;
        }
        if (body.spinPeriod !== 0) {
          body.spinMesh.rotation.y += ((Math.PI * 2) / body.spinPeriod) * delta;
        }
      });

      starGroup.rotation.y += delta * 0.0015;

      const focusId = selectedIdRef.current;
      if (focusId !== prevFocusId) {
        zoomFactorRef.current = 1;
        prevFocusId = focusId;
      }

      let desiredDistance = overviewDistance;
      let desiredFocus = ORIGIN;
      const focused = focusId ? bodyRefs.get(focusId) : null;
      if (focused) {
        focused.spinMesh.getWorldPosition(tmpFocus);
        desiredFocus = tmpFocus;
        desiredDistance = distanceForRadius(focused.radius, focusId === star?.id);
      }
      const targetDistance = desiredDistance * zoomFactorRef.current;

      const lerpAlpha = Math.min(1, delta * 3.2);
      currentDistance += (targetDistance - currentDistance) * lerpAlpha;
      currentFocus.lerp(desiredFocus, lerpAlpha);

      // Idle drift only when the child isn't actively dragging.
      if (!dragState.active) yaw += delta * 0.045;

      const clampedDistance = THREE.MathUtils.clamp(
        currentDistance,
        1.4,
        overviewDistance * 2.4,
      );
      camera.position.set(
        currentFocus.x + clampedDistance * Math.cos(pitch) * Math.sin(yaw),
        currentFocus.y + clampedDistance * Math.sin(pitch),
        currentFocus.z + clampedDistance * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.lookAt(currentFocus);

      if (focused) {
        selectionRing.visible = true;
        selectionRing.position.copy(desiredFocus);
        const ringScale = Math.max(focused.radius * 1.9, 0.22);
        selectionRing.scale.setScalar(ringScale);
        selectionRing.quaternion.copy(camera.quaternion);
      } else {
        selectionRing.visible = false;
      }

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
      // Browsers cap live WebGL contexts; without a forced release the old
      // context lingers until GC, and in the never-reloading kiosk session
      // repeated Space visits blank accelerated 2D canvases page-wide
      // (tracing's guide canvas was the first casualty).
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
              Space needs 3D graphics
            </p>
            <p className="mt-2 text-lg font-bold text-slate-600">
              {error} The planet facts still work from the picker row below.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
