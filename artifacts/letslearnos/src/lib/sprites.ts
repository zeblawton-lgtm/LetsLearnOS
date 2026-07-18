// ---------------------------------------------------------------------------
// Offline-first optional artwork resolution.
//
// Artwork is served only from the app's own origin. The public repository ships
// no proprietary character images; administrators may add a separately licensed
// local asset pack. Missing files fall back to a neutral bundled SVG and never
// trigger an external network request.
// ---------------------------------------------------------------------------

// Vite injects BASE_URL (for example "/" or "/letslearnos/"). Honor it so assets
// resolve correctly whatever the deploy base path is.
const BASE: string =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
  "/";

const root = BASE.endsWith("/") ? BASE : BASE + "/";

export const SPRITE_FALLBACK = `${root}sprites/fallback.svg`;

// Official-artwork style image (used everywhere the app showed Pokémon art).
export function ARTWORK(id: number): string {
  return `${root}sprites/official-artwork/${id}.png`;
}

// Small pixel sprite (kept for parity; same fallback applies).
export function SPRITE(id: number): string {
  return `${root}sprites/pokemon/${id}.png`;
}

// onError handler for <img>: swap to the bundled fallback exactly once so we
// never loop or hit the network.
export function onSpriteError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
) {
  const img = e.currentTarget;
  if (img.dataset.fallback === "1") return;
  img.dataset.fallback = "1";
  img.src = SPRITE_FALLBACK;
}
