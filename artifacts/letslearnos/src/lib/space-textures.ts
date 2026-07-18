// ---------------------------------------------------------------------------
// Procedurally generated planet/sun/ring/star textures for the Space module.
//
// Everything here is drawn at runtime with the Canvas 2D API — no imagery is
// downloaded or bundled as image files, keeping the module fully offline
// (ADR-014 / ADR-002). Each function returns a THREE.CanvasTexture; callers
// own disposal (dispose the texture's `.image` is a plain <canvas>, garbage
// collected once the texture and any material referencing it are disposed).
// ---------------------------------------------------------------------------
import * as THREE from "three";

type Colors = readonly [string, string, string];

function ctx2d(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return { canvas, ctx };
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

// Small deterministic PRNG so a given texture looks the same shape run to
// run (nice for the tap-radius math, not required for correctness).
function makeRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function fillBase(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.55, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function craters(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: Colors,
  count: number,
  seed: number,
) {
  const rand = makeRandom(seed);
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 3 + rand() * (w * 0.045);
    const shade = rand() > 0.5 ? colors[2] : colors[1];
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, shade);
    grad.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function horizontalBands(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: Colors,
  bandCount: number,
  seed: number,
) {
  const rand = makeRandom(seed);
  const bandHeight = h / bandCount;
  for (let i = 0; i < bandCount; i += 1) {
    const shade = [colors[0], colors[1], colors[2]][Math.floor(rand() * 3)];
    ctx.globalAlpha = 0.35 + rand() * 0.35;
    ctx.fillStyle = shade;
    const y = i * bandHeight;
    ctx.fillRect(0, y, w, bandHeight * (0.7 + rand() * 0.5));
  }
  ctx.globalAlpha = 1;

  // Wavy streaks along a few bands for turbulence.
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 2;
  for (let i = 0; i < bandCount; i += 2) {
    const y = i * bandHeight + bandHeight / 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * bandHeight * 0.18);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function blobs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  count: number,
  minR: number,
  maxR: number,
  seed: number,
  alpha = 0.85,
) {
  const rand = makeRandom(seed);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = h * 0.15 + rand() * h * 0.7;
    const r = minR + rand() * (maxR - minR);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.6) {
      const wobble = r * (0.7 + rand() * 0.5);
      const px = x + Math.cos(a) * wobble;
      const py = y + Math.sin(a) * wobble * 0.6;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function polarCaps(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const capHeight = h * 0.08;
  const top = ctx.createLinearGradient(0, 0, 0, capHeight);
  top.addColorStop(0, "rgba(255,255,255,0.9)");
  top.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, capHeight);

  const bottom = ctx.createLinearGradient(0, h - capHeight, 0, h);
  bottom.addColorStop(0, "rgba(255,255,255,0)");
  bottom.addColorStop(1, "rgba(255,255,255,0.85)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, h - capHeight, w, capHeight);
}

// --- Per-body surface generators -------------------------------------------

function paintMercury(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  craters(ctx, w, h, colors, 90, 11);
  craters(ctx, w, h, colors, 40, 47);
}

function paintVenus(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = w * 0.02;
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    const yStart = (h / 6) * i;
    ctx.moveTo(-40, yStart);
    for (let x = 0; x <= w + 40; x += 30) {
      ctx.lineTo(x, yStart + Math.sin(x * 0.02 + i * 1.3) * h * 0.08);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintEarth(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, ["#bfe9ff", colors[1], colors[2]]);
  blobs(ctx, w, h, colors[0], 7, w * 0.05, w * 0.12, 3, 0.95);
  blobs(ctx, w, h, "rgba(255,255,255,0.55)", 10, w * 0.03, w * 0.08, 91, 0.6);
  polarCaps(ctx, w, h);
}

function paintMars(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  blobs(ctx, w, h, colors[2], 8, w * 0.04, w * 0.09, 17, 0.5);
  polarCaps(ctx, w, h);
}

function paintJupiter(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  horizontalBands(ctx, w, h, colors, 10, 5);
  // Great Red Spot.
  const spotX = w * 0.62;
  const spotY = h * 0.58;
  const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, w * 0.09);
  spotGrad.addColorStop(0, "#e0603f");
  spotGrad.addColorStop(1, "rgba(224,96,63,0)");
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, w * 0.09, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintSaturn(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  horizontalBands(ctx, w, h, colors, 8, 23);
}

function paintUranus(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  horizontalBands(ctx, w, h, colors, 5, 61);
}

function paintNeptune(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  fillBase(ctx, w, h, colors);
  horizontalBands(ctx, w, h, colors, 7, 71);
  const spotX = w * 0.32;
  const spotY = h * 0.42;
  const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, w * 0.07);
  spotGrad.addColorStop(0, colors[2]);
  spotGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = spotGrad;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, w * 0.07, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function paintRocky(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors, seed: number) {
  fillBase(ctx, w, h, colors);
  craters(ctx, w, h, colors, 55, seed);
}

const PAINTERS: Record<string, (ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) => void> = {
  mercury: paintMercury,
  venus: paintVenus,
  earth: paintEarth,
  mars: paintMars,
  jupiter: paintJupiter,
  saturn: paintSaturn,
  uranus: paintUranus,
  neptune: paintNeptune,
};

// Builds a seamless-enough equirectangular texture for a body's surface.
export function createPlanetTexture(id: string, colors: Colors, detail: "high" | "low" = "high"): THREE.CanvasTexture {
  const w = detail === "high" ? 512 : 320;
  const h = detail === "high" ? 256 : 160;
  const { canvas, ctx } = ctx2d(w, h);
  const painter = PAINTERS[id];
  if (painter) {
    painter(ctx, w, h, colors);
  } else {
    // Dwarf planets and anything unrecognised: cratered rocky/icy surface.
    let seed = 1;
    for (let i = 0; i < id.length; i += 1) seed += id.charCodeAt(i) * (i + 1);
    paintRocky(ctx, w, h, colors, seed);
  }
  return finish(canvas);
}

// The Sun's own emissive surface — bright core with warm mottling.
export function createSunTexture(colors: Colors): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const { canvas, ctx } = ctx2d(w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.5, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, colors[0], 14, w * 0.02, w * 0.06, 7, 0.35);
  blobs(ctx, w, h, colors[2], 10, w * 0.02, w * 0.05, 29, 0.25);
  return finish(canvas);
}

// A soft radial-gradient sprite used (layered, additive) to fake a bloom
// glow around the Sun for a fraction of the cost of real postprocessing.
export function createGlowTexture(color: string): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = ctx2d(size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// A single soft dot used for individual background stars (drawn once, reused
// across every star in the THREE.Points sprite via `map` + `sizeAttenuation`).
export function createStarSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const { canvas, ctx } = ctx2d(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Radial gradient strip for Saturn's (or Haumea's) ring — banded so it reads
// as ice/rock chunks rather than a flat disc. RingGeometry UVs run 0→1 from
// inner edge to outer edge along `u`, so a 1px-tall horizontal strip works.
export function createRingTexture(colors: Colors): THREE.CanvasTexture {
  const w = 256;
  const h = 32;
  const { canvas, ctx } = ctx2d(w, h);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.12, `${colors[1]}cc`);
  grad.addColorStop(0.3, `${colors[0]}55`);
  grad.addColorStop(0.42, `${colors[2]}ee`);
  grad.addColorStop(0.55, `${colors[1]}cc`);
  grad.addColorStop(0.72, `${colors[0]}88`);
  grad.addColorStop(0.88, `${colors[2]}66`);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface StarfieldLayer {
  count: number;
  radius: number;
  size: number;
  opacity: number;
  colors: string[];
}

// Builds a THREE.Points geometry scattered on a spherical shell for a
// starfield layer. Kept as plain position + color arrays (cheap: one draw
// call per layer, no per-frame updates).
export function createStarfieldGeometry(layer: StarfieldLayer): THREE.BufferGeometry {
  const positions = new Float32Array(layer.count * 3);
  const colorArray = new Float32Array(layer.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < layer.count; i += 1) {
    // Uniform-ish distribution on a sphere shell (with slight radius jitter
    // so it reads as volumetric rather than a perfect ball).
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = layer.radius * (0.85 + Math.random() * 0.15);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    color.set(layer.colors[Math.floor(Math.random() * layer.colors.length)]);
    colorArray[i * 3] = color.r;
    colorArray[i * 3 + 1] = color.g;
    colorArray[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
  return geometry;
}
