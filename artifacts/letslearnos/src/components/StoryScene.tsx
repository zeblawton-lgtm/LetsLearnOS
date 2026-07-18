// ---------------------------------------------------------------------------
// Story Time 3D diorama renderer (WebGL / three.js), rebuilt per ADR-018.
// One persistent renderer/camera/lighting rig lives for the reader's whole
// lifetime (mirrors EarthScene/ScienceScene's lifecycle discipline: capped
// device pixel ratio, ResizeObserver-driven resize, webglcontextlost
// handling with a narrated fallback, full disposal + forceContextLoss on
// unmount) — but unlike those two scenes, Story Time's content genuinely
// changes every page (a picture book turns from a forest to a snowy hill),
// so the diorama itself — ground, props, ambient particles, Pokémon
// billboards — is deliberately rebuilt on every page turn, with the
// outgoing page's objects fully disposed first. `buildPage` is defined once
// inside the one-time mount effect (so it can close over the renderer/scene/
// camera/shared textures without recreating them) and stashed in a ref so a
// second, lightweight effect can invoke it whenever `pageKey` changes —
// exactly once per page turn, including the very first page.
//
// Pokémon render as camera-facing Sprite billboards loaded from the bundled
// official-artwork PNGs (see lib/sprites.ts's ARTWORK) with a spring-style
// pop-in entrance and a gentle idle bob; missing artwork swaps to a
// procedurally drawn neutral fallback texture exactly once (never network,
// loops — mirrors sprites.ts's onSpriteError for the 2D pages). Camera does
// a quick "swoop in" sweep on every page turn (<600ms) plus a slow
// continuous idle drift so the diorama never looks static, all narrated
// separately by the parent's sentence-by-sentence read-along (this
// component never touches TTS or page text — the reader's text panel is a
// DOM overlay drawn by the parent).
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { StoryScene as StoryEnvironment } from "@/content/stories";
import { ARTWORK } from "@/lib/sprites";
import { ParticlePool } from "@/lib/science-particles";
import { createGlowTexture, createStarSpriteTexture } from "@/lib/space-textures";

interface StorySceneProps {
  /** Which of the seven picture-book environments this page uses. */
  scene: StoryEnvironment;
  /** Sprite ids to show, in display order (1-3 entries). */
  pokemonIds: number[];
  /** Changes exactly once per page turn (e.g. `${storyId}-${pageIndex}`) —
   *  the sole trigger for rebuilding the diorama's contents. Two adjacent
   *  pages can share the same scene/pokemonIds (common in these stories),
   *  so the rebuild must be keyed on this rather than on scene/pokemonIds
   *  changing, or a same-content page turn would silently skip its
   *  entrance animation and camera sweep. */
  pageKey: string;
  /** Fired once if the 3D scene fails to start or loses its WebGL context
   *  (never cleared — a lost context doesn't come back on its own). Parent
   *  narrates the fallback for pre-readers. */
  onError?: (message: string) => void;
  className?: string;
}

// --- Palettes -----------------------------------------------------------
// Mirrors stories.tsx's SCENE_GRADIENTS / GROUND_COLORS hex stops so the 3D
// diorama and the (now-retired) CSS backdrop read as the same place. Kept
// here rather than in content/stories.ts because these are 3D rendering
// details, not story content — stories.ts's exported shape is untouched.
const SKY_PALETTE: Record<StoryEnvironment, [string, string, string]> = {
  meadow: ["#8ed4ff", "#c8ecff", "#b6e88a"],
  forest: ["#bfe9ff", "#d7f5c8", "#5aa856"],
  beach: ["#7fd7ff", "#bdeeff", "#ffe9a8"],
  pond: ["#a6e3ff", "#d7f3e6", "#8fd6c2"],
  mountain: ["#a9d6ff", "#e3eef7", "#b7b0a6"],
  snow: ["#cdeeff", "#eef8ff", "#ffffff"],
  night: ["#1b2a63", "#33438c", "#5c6bab"],
};
const GROUND_BASE: Record<StoryEnvironment, string> = {
  meadow: "#79c94d",
  forest: "#4f9a4a",
  beach: "#f3d999",
  pond: "#7fcbd8",
  mountain: "#c9c2b3",
  snow: "#ffffff",
  night: "#28305e",
};

const TAU = Math.PI * 2;
const ENTRY_DURATION = 0.5;
const SWEEP_DURATION = 0.55;

function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const clampByte = (v: number) => Math.min(255, Math.max(0, v));
  const r = clampByte(((num >> 16) & 0xff) + Math.round(255 * percent));
  const g = clampByte(((num >> 8) & 0xff) + Math.round(255 * percent));
  const b = clampByte((num & 0xff) + Math.round(255 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
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

// A soft 3-stop vertical gradient used as the scene's flat 2D background
// (three.js draws a plain Texture background in screen space — no need for
// an equirectangular skydome for a diorama whose camera never turns far).
function makeSkyTexture(scene: StoryEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const [top, mid, bottom] = SKY_PALETTE[scene];
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, top);
  grad.addColorStop(0.5, mid);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Runtime canvas-2D ground texture (same speckled-gradient idiom as
// ScienceScene's makeGroundTexture), tinted per scene from GROUND_BASE.
function makeGroundTexture(scene: StoryEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const base = GROUND_BASE[scene];
  const light = shade(base, 0.16);
  const dark = shade(base, -0.18);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 500; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Deterministic neutral fallback, redrawn for each billboard that needs it
// (cheap 256px canvas draw) rather than shared, so disposeObject3D's
// generic per-mesh `material.map?.dispose()` sweep can never double-dispose
// a texture two billboards were both still using.
function createFallbackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const cx = 128;
  const cy = 128;
  const r = 108;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#ee1515";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(cx - r, cy - 6, r * 2, 12);
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, TAU);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, TAU);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function coneTree(x: number, z: number, scale: number, group: THREE.Group) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * scale, 0.12 * scale, 0.55 * scale, 8),
    new THREE.MeshStandardMaterial({ color: "#8a5a35", roughness: 0.9 }),
  );
  trunk.position.set(x, 0.28 * scale, z);
  group.add(trunk);
  const tiers = [0.62, 0.48, 0.34];
  tiers.forEach((h, i) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry((0.42 - i * 0.06) * scale, h * scale, 9),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? "#4f9a4a" : "#5cb24a", roughness: 0.85 }),
    );
    cone.position.set(x, (0.6 + i * 0.42) * scale, z);
    group.add(cone);
  });
}

function snowTree(x: number, z: number, scale: number, group: THREE.Group) {
  coneTree(x, z, scale, group);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.16 * scale, 0.16 * scale, 9),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }),
  );
  cap.position.set(x, (0.6 + 2 * 0.42) * scale + 0.32 * scale, z);
  group.add(cap);
}

function flowerCluster(x: number, z: number, petalColor: string, group: THREE.Group) {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: "#4c9a3f" }),
  );
  stem.position.set(x, 0.2, z);
  group.add(stem);
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({ color: "#ffd76a" }),
  );
  center.position.set(x, 0.42, z);
  group.add(center);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * TAU;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshStandardMaterial({ color: petalColor }),
    );
    petal.scale.set(1.3, 0.55, 0.7);
    petal.position.set(x + Math.cos(angle) * 0.11, 0.42, z + Math.sin(angle) * 0.11);
    group.add(petal);
  }
}

function mountainCone(x: number, z: number, height: number, radius: number, color: string, group: THREE.Group) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 5),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }),
  );
  cone.position.set(x, height / 2, z);
  cone.rotation.y = Math.random() * TAU;
  group.add(cone);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.4, height * 0.28, 5),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
  );
  cap.position.set(x, height * 0.92, z);
  group.add(cap);
}

function snowdrift(x: number, z: number, scale: number, group: THREE.Group) {
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.55 * scale, 16, 10),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
  );
  mound.scale.set(1, 0.5, 1);
  mound.position.set(x, 0.18 * scale, z);
  group.add(mound);
}

function shellProp(x: number, z: number, color: string, group: THREE.Group) {
  const shell = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.05, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  shell.rotation.x = -Math.PI / 2;
  shell.position.set(x, 0.06, z);
  group.add(shell);
}

function pondDisc(group: THREE.Group) {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 0.05, 32),
    new THREE.MeshStandardMaterial({
      color: "#6fb8c9",
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
      metalness: 0.15,
    }),
  );
  disc.position.set(0, 0.045, -0.6);
  group.add(disc);
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * TAU + 0.4;
    const lily = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 12),
      new THREE.MeshStandardMaterial({ color: "#4f9a4a", side: THREE.DoubleSide }),
    );
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(Math.cos(angle) * 1.2, 0.08, -0.6 + Math.sin(angle) * 1.2);
    group.add(lily);
  }
}

function waveBackdrop(group: THREE.Group) {
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(6, 32, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: "#4fa9d8", transparent: true, opacity: 0.85, roughness: 0.2 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.04, -4.6);
  group.add(sea);
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(3.7, 3.95, 32, 1, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.05, -4.6);
  group.add(foam);
}

// Creates its own glow texture rather than accepting a shared one: this
// sprite lives inside the per-page group, and disposeObject3D's generic
// sweep unconditionally disposes every mesh/sprite's `material.map` when
// that page is torn down on the next page turn — sharing a texture across
// pages through the conventional `.map` slot would get it destroyed the
// first time any page used it, breaking every later page that needed it
// too (ParticlePool sidesteps this by tucking its shared texture into a
// custom ShaderMaterial uniform the generic sweep can't see — see the
// mount-effect comment on `dotTexture`). A fresh 256px canvas draw per page
// is cheap enough that owning one outright is simpler than fighting that.
function moonProp(group: THREE.Group) {
  const material = new THREE.SpriteMaterial({
    map: createGlowTexture("#f5f1d6"),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const moon = new THREE.Sprite(material);
  moon.scale.set(1.5, 1.5, 1);
  moon.position.set(2.4, 3.6, -3.5);
  group.add(moon);
}

// --- Per-scene prop placement (2-4 simple primitives, per ADR-018). -------
function buildSceneProps(scene: StoryEnvironment, group: THREE.Group) {
  switch (scene) {
    case "forest":
      coneTree(-2.9, -2.1, 1.5, group);
      coneTree(2.6, -2.6, 1.9, group);
      coneTree(0.3, -3.4, 1.2, group);
      break;
    case "beach":
      waveBackdrop(group);
      shellProp(-1.8, 1.6, "#ffb3c6", group);
      shellProp(1.6, 2.1, "#ffe9a8", group);
      break;
    case "mountain":
      mountainCone(-2.4, -3.2, 3.4, 1.5, "#a79f92", group);
      mountainCone(1.1, -3.8, 4.2, 1.8, "#8f8778", group);
      mountainCone(3.3, -3, 2.6, 1.2, "#b7b0a6", group);
      break;
    case "meadow":
      flowerCluster(-2.4, 1.2, "#ff7fa8", group);
      flowerCluster(-0.6, 1.9, "#ffd76a", group);
      flowerCluster(1.5, 1.3, "#c78bff", group);
      flowerCluster(2.9, 2.1, "#ff7fa8", group);
      break;
    case "night":
      moonProp(group);
      coneTree(-3, -2.4, 1.4, group);
      coneTree(2.9, -2.8, 1.6, group);
      break;
    case "snow":
      snowdrift(-2.6, 1.4, 1.3, group);
      snowdrift(2.2, 1.8, 1, group);
      snowTree(0.4, -2.6, 1.5, group);
      break;
    case "pond":
      pondDisc(group);
      flowerCluster(-3, 2, "#ffd76a", group);
      break;
  }
}

// --- Ambient effect controller (one per page, disposed on rebuild) -------
interface AmbientController {
  tick: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

const LEAF_COLORS = ["#7fbf5a", "#a8d86a", "#e8895f", "#ffd76a"];
const PETAL_COLORS = ["#ff9fc2", "#ffe08a", "#ffffff", "#c9a6ff"];

function createParticleAmbient(
  group: THREE.Group,
  texture: THREE.Texture,
  options: {
    max: number;
    blending: THREE.Blending;
    gravity: number;
    drag: number;
    growPortion: number;
    rate: number;
    colors: string[];
    spawn: () => { x: number; y: number; z: number };
    velocity: () => { x: number; y: number; z: number };
    size: number;
    life: number;
  },
): AmbientController {
  const pool = new ParticlePool({
    max: options.max,
    texture,
    blending: options.blending,
    gravity: options.gravity,
    drag: options.drag,
    growPortion: options.growPortion,
  });
  group.add(pool.points);
  let accum = 0;
  return {
    tick(delta) {
      accum += delta * options.rate;
      while (accum >= 1) {
        accum -= 1;
        const p = options.spawn();
        const v = options.velocity();
        pool.emit({
          position: new THREE.Vector3(p.x, p.y, p.z),
          velocity: new THREE.Vector3(v.x, v.y, v.z),
          color: new THREE.Color(options.colors[Math.floor(Math.random() * options.colors.length)]),
          peakSize: options.size * (0.7 + Math.random() * 0.5),
          endSize: options.size * 0.15,
          life: options.life * (0.7 + Math.random() * 0.6),
        });
      }
      pool.update(delta);
    },
    dispose() {
      pool.dispose();
    },
  };
}

// Each sprite gets its own glow texture draw (same page-ownership reasoning
// as moonProp above) — cheap, and keeps this scene's cloud sprites safe to
// dispose generically on the next page turn without touching anything
// another page might still be using.
function createCloudAmbient(group: THREE.Group): AmbientController {
  const sprites: THREE.Sprite[] = [];
  [-5, 0, 4.5].forEach((startX, i) => {
    const material = new THREE.SpriteMaterial({
      map: createGlowTexture("#ffffff"),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.6 + i * 0.4, 1.1 + i * 0.15, 1);
    sprite.position.set(startX, 4.4 + i * 0.3, -4 - i * 0.4);
    group.add(sprite);
    sprites.push(sprite);
  });
  return {
    tick(delta) {
      sprites.forEach((sprite, i) => {
        sprite.position.x += delta * (0.18 + i * 0.05);
        if (sprite.position.x > 6.5) sprite.position.x = -6.5;
      });
    },
    dispose() {
      sprites.forEach((sprite) => {
        const material = sprite.material as THREE.SpriteMaterial;
        material.map?.dispose();
        material.dispose();
      });
    },
  };
}

// Owns its own star-sprite texture (via the conventional PointsMaterial.map
// slot) rather than reusing the mount-level shared `dotTexture` — that
// shared instance is only ever safe to reuse through ParticlePool's custom
// ShaderMaterial uniform, which the generic per-page disposal sweep can't
// see; a plain PointsMaterial.map is exactly what that sweep does look for.
function createStarAmbient(group: THREE.Group): AmbientController {
  const geometry = new THREE.BufferGeometry();
  const count = 240;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const radiusXZ = 3 + Math.random() * 5.5;
    positions[i * 3] = Math.cos(angle) * radiusXZ;
    positions[i * 3 + 1] = 2.2 + Math.random() * 4.2;
    positions[i * 3 + 2] = -1 - Math.sin(angle) * radiusXZ * 0.6 - Math.random() * 2;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.14,
    map: createStarSpriteTexture(),
    color: "#fff6da",
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);
  return {
    tick(_delta, elapsed) {
      material.opacity = 0.65 + Math.sin(elapsed * 1.4) * 0.2;
    },
    dispose() {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
  };
}

function createAmbient(
  scene: StoryEnvironment,
  group: THREE.Group,
  dotTexture: THREE.Texture,
): AmbientController {
  switch (scene) {
    case "forest":
      return createParticleAmbient(group, dotTexture, {
        max: 90,
        blending: THREE.NormalBlending,
        gravity: -0.15,
        drag: 0.15,
        growPortion: 0.15,
        rate: 4,
        colors: LEAF_COLORS,
        spawn: () => ({ x: (Math.random() - 0.5) * 7, y: 3.4 + Math.random() * 1.2, z: -2.5 + Math.random() * 2 }),
        velocity: () => ({ x: (Math.random() - 0.5) * 0.3, y: -0.35, z: (Math.random() - 0.5) * 0.1 }),
        size: 0.14,
        life: 4,
      });
    case "beach":
      return createParticleAmbient(group, dotTexture, {
        max: 70,
        blending: THREE.AdditiveBlending,
        gravity: 0,
        drag: 0.3,
        growPortion: 0.2,
        rate: 8,
        colors: ["#ffffff", "#eaf6ff", "#ffe9a8"],
        spawn: () => ({ x: (Math.random() - 0.5) * 6, y: 0.15 + Math.random() * 0.15, z: -4.6 + (Math.random() - 0.5) * 2.5 }),
        velocity: () => ({ x: (Math.random() - 0.5) * 0.15, y: 0.25 + Math.random() * 0.2, z: (Math.random() - 0.5) * 0.15 }),
        size: 0.08,
        life: 0.8,
      });
    case "mountain":
      return createCloudAmbient(group);
    case "meadow":
      return createParticleAmbient(group, dotTexture, {
        max: 90,
        blending: THREE.NormalBlending,
        gravity: -0.1,
        drag: 0.2,
        growPortion: 0.15,
        rate: 3.5,
        colors: PETAL_COLORS,
        spawn: () => ({ x: (Math.random() - 0.5) * 7, y: 3 + Math.random() * 1.3, z: -1.5 + Math.random() * 2.5 }),
        velocity: () => ({ x: (Math.random() - 0.5) * 0.4, y: -0.28, z: (Math.random() - 0.5) * 0.15 }),
        size: 0.1,
        life: 3.5,
      });
    case "night":
      return createStarAmbient(group);
    case "snow":
      return createParticleAmbient(group, dotTexture, {
        max: 110,
        blending: THREE.NormalBlending,
        gravity: -0.3,
        drag: 0.2,
        growPortion: 0.1,
        rate: 9,
        colors: ["#ffffff", "#f2fbff"],
        spawn: () => ({ x: (Math.random() - 0.5) * 7.5, y: 3.6 + Math.random() * 1, z: -2.5 + Math.random() * 3 }),
        velocity: () => ({ x: (Math.random() - 0.5) * 0.1, y: -0.4, z: 0 }),
        size: 0.09,
        life: 5,
      });
    case "pond":
      return createParticleAmbient(group, dotTexture, {
        max: 60,
        blending: THREE.AdditiveBlending,
        gravity: 0,
        drag: 0.55,
        growPortion: 0.25,
        rate: 3,
        colors: ["#fff2a0", "#ffe37a"],
        spawn: () => ({ x: (Math.random() - 0.5) * 3.4, y: 0.5 + Math.random() * 0.9, z: -0.6 + (Math.random() - 0.5) * 2 }),
        velocity: () => ({ x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.15, z: (Math.random() - 0.5) * 0.2 }),
        size: 0.05,
        life: 2.6,
      });
  }
}

interface Billboard {
  sprite: THREE.Sprite;
  baseY: number;
  targetScale: number;
  entryStart: number;
  idx: number;
}

const SPACING: Record<number, number[]> = {
  1: [0],
  2: [-1.15, 1.15],
  3: [-1.9, 0, 1.9],
};

export function StoryScene({ scene, pokemonIds, pageKey, onError, className }: StorySceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef(scene);
  const pokemonIdsRef = useRef(pokemonIds);
  const onErrorRef = useRef(onError);
  const buildPageRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);
  useEffect(() => {
    pokemonIdsRef.current = pokemonIds;
  }, [pokemonIds]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; renderer/camera live for the component's lifetime
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      setError(null);
    } catch (err) {
      console.error("Unable to start the story diorama.", err);
      const message = "This device could not start the 3D storybook scene.";
      setError(message);
      onErrorRef.current?.(message);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight("#eaf6ff", "#3a4326", 0.9);
    threeScene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight("#fff6da", 1.4);
    keyLight.position.set(5, 8, 5);
    threeScene.add(keyLight);

    // The one texture genuinely shared across every page turn: only ever
    // referenced through ParticlePool's custom ShaderMaterial uniform
    // (never the conventional `material.map` slot), which is exactly why
    // it's safe to keep alive across a page rebuild's generic disposal
    // sweep — same idiom as ScienceScene's shared dotTexture. Every other
    // procedural texture (glows, moon, star field) is page-owned and
    // created fresh per build; see the comments on moonProp/createCloud
    // Ambient/createStarAmbient for why that split matters.
    const dotTexture = createStarSpriteTexture();
    const textureLoader = new THREE.TextureLoader();

    let pageGroup: THREE.Group | null = null;
    let ambient: AmbientController | null = null;
    let skyTexture: THREE.CanvasTexture | null = null;
    let billboards: Billboard[] = [];
    let buildGen = 0;
    let elapsed = 0;
    let sweepStart = 0;

    function buildPage() {
      buildGen += 1;
      const myGen = buildGen;

      if (pageGroup) {
        threeScene.remove(pageGroup);
        disposeObject3D(pageGroup);
        pageGroup = null;
      }
      if (ambient) {
        ambient.dispose();
        ambient = null;
      }
      if (skyTexture) {
        skyTexture.dispose();
        skyTexture = null;
      }
      billboards = [];

      const currentScene = sceneRef.current;
      const currentIds = pokemonIdsRef.current;
      const isNight = currentScene === "night";

      skyTexture = makeSkyTexture(currentScene);
      threeScene.background = skyTexture;
      threeScene.fog = new THREE.Fog(SKY_PALETTE[currentScene][1], 8, 19);

      hemiLight.color.set(isNight ? "#39447c" : "#eaf6ff");
      hemiLight.groundColor.set(isNight ? "#0c1030" : "#3a4326");
      hemiLight.intensity = isNight ? 0.55 : 0.9;
      keyLight.color.set(isNight ? "#9fb0ff" : "#fff6da");
      keyLight.intensity = isNight ? 0.7 : 1.4;

      const group = new THREE.Group();
      threeScene.add(group);
      pageGroup = group;

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 10),
        new THREE.MeshStandardMaterial({ map: makeGroundTexture(currentScene), roughness: 0.95 }),
      );
      ground.rotation.x = -Math.PI / 2;
      group.add(ground);

      buildSceneProps(currentScene, group);
      ambient = createAmbient(currentScene, group, dotTexture);

      const ids = currentIds.slice(0, 3);
      const count = Math.max(1, ids.length);
      const xs = SPACING[count] ?? ids.map((_, i) => (i - (count - 1) / 2) * 1.6);
      const targetScale = count <= 1 ? 2.1 : count === 2 ? 1.7 : 1.35;

      billboards = ids.map((id, idx) => {
        const material = new THREE.SpriteMaterial({
          map: null,
          transparent: true,
          alphaTest: 0.1,
          depthWrite: true,
          opacity: 0,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.001, 0.001, 1);
        sprite.position.set(xs[idx] ?? 0, targetScale / 2, idx * 0.05 - ((count - 1) * 0.025));
        group.add(sprite);

        textureLoader.load(
          ARTWORK(id),
          (tex) => {
            if (myGen !== buildGen) {
              tex.dispose();
              return;
            }
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            material.map = tex;
            material.needsUpdate = true;
          },
          undefined,
          () => {
            if (myGen !== buildGen) return;
            material.map = createFallbackTexture();
            material.needsUpdate = true;
          },
        );

        return {
          sprite,
          baseY: targetScale / 2,
          targetScale,
          entryStart: elapsed + idx * 0.1,
          idx,
        };
      });

      sweepStart = elapsed;
    }
    buildPageRef.current = buildPage;

    // --- Resize (writes the canvas CSS size — see EarthScene's identical
    // note on why the attribute size must not silently become the layout
    // size at DPR 2 on the kiosk's 200% scaling). ------------------------
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

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      const message = "The storybook scene stopped drawing.";
      setError(message);
      onErrorRef.current?.(message);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    // --- Camera rig: a fixed resting position with a slow idle drift (so
    // pages never look static) plus a quick "swoop in" sweep on every page
    // turn — the sweep uses a pulled-back start offset that eases to zero
    // within SWEEP_DURATION (<600ms), masking the instant diorama swap. ---
    const REST_POS = new THREE.Vector3(0, 2.5, 6.6);
    const REST_LOOK = new THREE.Vector3(0, 1.0, -0.6);
    const SWEEP_OFFSET = new THREE.Vector3(0, 1.1, 1.9);

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      elapsed += delta;

      ambient?.tick(delta, elapsed);

      billboards.forEach((b) => {
        const t = Math.min(1, Math.max(0, (elapsed - b.entryStart) / ENTRY_DURATION));
        const eased = t <= 0 ? 0 : easeOutBack(t);
        const scale = Math.max(0.001, b.targetScale * eased);
        b.sprite.scale.set(scale, scale, 1);
        const material = b.sprite.material as THREE.SpriteMaterial;
        material.opacity = Math.min(1, t / 0.35);
        const bob = Math.sin(elapsed * 1.6 + b.idx * 1.7) * 0.05 * Math.min(1, t * 3);
        b.sprite.position.y = b.baseY + bob;
      });

      const driftYaw = Math.sin(elapsed * 0.15) * 0.22;
      const driftBob = Math.sin(elapsed * 0.27) * 0.08;
      const sweepT = Math.min(1, (elapsed - sweepStart) / SWEEP_DURATION);
      const sweepEase = 1 - easeOutCubic(sweepT);

      camera.position.set(
        REST_POS.x + Math.sin(driftYaw) * 0.35 + SWEEP_OFFSET.x * sweepEase,
        REST_POS.y + driftBob + SWEEP_OFFSET.y * sweepEase,
        REST_POS.z + SWEEP_OFFSET.z * sweepEase,
      );
      camera.lookAt(REST_LOOK.x, REST_LOOK.y, REST_LOOK.z);

      renderer.render(threeScene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      buildPageRef.current = null;
      buildGen += 1; // invalidate any in-flight texture loads
      ambient?.dispose();
      skyTexture?.dispose();
      // Sweeps everything still attached — the current pageGroup (ground,
      // props, billboards) plus the lights. Every texture reachable this
      // way is page-owned (see the moonProp/createCloudAmbient/
      // createStarAmbient comments); the one exception, the shared
      // dotTexture, is deliberately invisible to this generic sweep (it
      // only lives in ParticlePool's ShaderMaterial uniform) and gets its
      // own explicit dispose below.
      disposeObject3D(threeScene);
      dotTexture.dispose();
      renderer.dispose();
      // Browsers cap live WebGL contexts; without a forced release the old
      // context lingers until GC and days of page hops brick the kiosk
      // (same lesson EarthScene/ScienceScene already learned).
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the diorama's contents on every page turn (including the very
  // first page) — deliberately keyed on pageKey alone, see the prop comment
  // above for why scene/pokemonIds can't be the trigger.
  useEffect(() => {
    buildPageRef.current?.();
  }, [pageKey]);

  return (
    <div ref={mountRef} className={`touch-none ${className ?? ""}`}>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-xl rounded-3xl bg-white/95 p-6 text-center shadow-2xl">
            <p className="text-2xl font-black text-slate-900">
              Story scene needs 3D graphics
            </p>
            <p className="mt-2 text-lg font-bold text-slate-600">
              {error} The story text and buttons below still work.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
