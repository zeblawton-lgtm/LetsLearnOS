// ---------------------------------------------------------------------------
// Lightweight GPU particle pool for the Science 3D Lab (ADR-017).
//
// One THREE.Points draw call per pool, with per-particle size + alpha driven
// by a small custom ShaderMaterial — three.js's built-in PointsMaterial only
// exposes a single global `size`, so a grow-then-shrink-and-fade particle
// (fire needs this) requires its own attributes, per the build brief's perf
// section recommendation (b). `map` is meant to be one of the shared,
// procedurally-generated textures from space-textures.ts (createStarSpriteTexture
// works well as the universal soft dot — tint per pool/particle via color).
//
// Physics are a plain custom integration (gravity + drag + lifetime) tied to
// the caller's already-capped `delta` — no physics-engine dependency
// (ADR-017). Particles recycle through a ring buffer: emit() always advances
// a cursor and overwrites whatever slot it lands on, so a pool can never grow
// past `max` — callers should rate-limit emission to their effect's budget
// (see the build brief's per-effect particle counts).
// ---------------------------------------------------------------------------
import * as THREE from "three";

export interface ParticlePoolOptions {
  /** Fixed pool size — never exceeded; emit() recycles the oldest slot. */
  max: number;
  /** Shared sprite texture (e.g. createStarSpriteTexture()); pool does not own it. */
  texture: THREE.Texture;
  blending?: THREE.Blending;
  /** World-units/s^2 applied to every live particle's Y velocity each frame
   *  (negative falls, positive rises — used for buoyant smoke/embers). */
  gravity?: number;
  /** Fraction of velocity removed per second (0 = frictionless, 1 = stops instantly). */
  drag?: number;
  /** Fraction of a particle's lifetime spent growing in before it holds/shrinks (0..1). */
  growPortion?: number;
}

export interface EmitOptions {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  peakSize: number;
  endSize?: number;
  life: number;
}

const VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float pointSize = aSize * (420.0 / max(-mvPosition.z, 0.001));
    gl_PointSize = min(pointSize, 220.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    if (tex.a < 0.01 || vAlpha <= 0.0) discard;
    gl_FragColor = vec4(vColor, tex.a * vAlpha);
  }
`;

// Recycled per emit() call so the hot path never allocates.
const tmpColor = new THREE.Color();

export class ParticlePool {
  readonly points: THREE.Points;
  readonly max: number;
  private readonly gravity: number;
  private readonly drag: number;
  private readonly growPortion: number;

  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly peakSizes: Float32Array;
  private readonly endSizes: Float32Array;
  private cursor = 0;

  constructor(options: ParticlePoolOptions) {
    this.max = options.max;
    this.gravity = options.gravity ?? -2.2;
    this.drag = options.drag ?? 0.4;
    this.growPortion = THREE.MathUtils.clamp(options.growPortion ?? 0.25, 0.01, 0.9);

    this.positions = new Float32Array(this.max * 3);
    this.colors = new Float32Array(this.max * 3);
    this.sizes = new Float32Array(this.max);
    this.alphas = new Float32Array(this.max);
    this.velocities = new Float32Array(this.max * 3);
    this.ages = new Float32Array(this.max).fill(Infinity);
    this.lifetimes = new Float32Array(this.max).fill(1);
    this.peakSizes = new Float32Array(this.max);
    this.endSizes = new Float32Array(this.max);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphas, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: options.texture } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: options.blending ?? THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  /** Spawn (or recycle) one particle. Rate-limit calls at the effect level —
   *  the pool itself has no concept of "budget" beyond wrapping at `max`. */
  emit(options: EmitOptions) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;

    this.positions[i * 3] = options.position.x;
    this.positions[i * 3 + 1] = options.position.y;
    this.positions[i * 3 + 2] = options.position.z;
    this.velocities[i * 3] = options.velocity.x;
    this.velocities[i * 3 + 1] = options.velocity.y;
    this.velocities[i * 3 + 2] = options.velocity.z;
    this.colors[i * 3] = options.color.r;
    this.colors[i * 3 + 1] = options.color.g;
    this.colors[i * 3 + 2] = options.color.b;
    this.peakSizes[i] = options.peakSize;
    this.endSizes[i] = options.endSize ?? 0;
    this.ages[i] = 0;
    this.lifetimes[i] = Math.max(options.life, 0.05);
  }

  /** Convenience: pick a random color between two hex/CSS colors and emit. */
  emitTinted(options: Omit<EmitOptions, "color"> & { colorA: string; colorB: string; mix?: number }) {
    tmpColor.set(options.colorA).lerp(new THREE.Color(options.colorB), options.mix ?? Math.random());
    this.emit({ ...options, color: tmpColor.clone() });
  }

  /** Integrate every live particle by `delta` seconds (already capped by the caller). */
  update(delta: number) {
    const dragFactor = Math.max(0, 1 - this.drag * delta);
    let touched = false;
    for (let i = 0; i < this.max; i += 1) {
      if (this.ages[i] >= this.lifetimes[i]) {
        continue;
      }
      touched = true;
      this.ages[i] += delta;
      const life = this.lifetimes[i];
      const t = Math.min(this.ages[i] / life, 1);

      this.velocities[i * 3 + 1] += this.gravity * delta;
      this.velocities[i * 3] *= dragFactor;
      this.velocities[i * 3 + 1] *= dragFactor;
      this.velocities[i * 3 + 2] *= dragFactor;

      this.positions[i * 3] += this.velocities[i * 3] * delta;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * delta;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * delta;

      const grow = this.growPortion;
      const peak = this.peakSizes[i];
      if (t < grow) {
        this.sizes[i] = peak * (t / grow);
      } else {
        const shrinkT = (t - grow) / (1 - grow);
        this.sizes[i] = THREE.MathUtils.lerp(peak, this.endSizes[i], shrinkT);
      }
      // Quick fade-in, gentle fade-out so nothing pops in/out abruptly.
      const fadeIn = Math.min(t / 0.08, 1);
      const fadeOut = 1 - Math.max((t - 0.7) / 0.3, 0);
      this.alphas[i] = Math.max(0, Math.min(fadeIn, fadeOut));

      if (this.ages[i] >= life) this.alphas[i] = 0;
    }

    if (touched) {
      (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Tiny hand-rolled spring integrator (no physics-engine dependency, per
 *  ADR-017) for "grow with a gentle bounce" animations — the Plant station's
 *  stem/leaves/flower scale toward their stage targets through this each
 *  frame, using the same capped `delta` as everything else. */
export function springTo(
  current: number,
  velocity: number,
  target: number,
  delta: number,
  stiffness = 90,
  damping = 12,
): { value: number; velocity: number } {
  const accel = stiffness * (target - current) - damping * velocity;
  const nextVelocity = velocity + accel * delta;
  const nextValue = current + nextVelocity * delta;
  return { value: nextValue, velocity: nextVelocity };
}
