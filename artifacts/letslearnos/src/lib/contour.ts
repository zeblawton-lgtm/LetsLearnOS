// ---------------------------------------------------------------------------
// contour.ts — Runtime outline-point extraction from bundled Pokémon artwork.
//
// Given an image URL (transparent-background PNG), this module:
//   1. Rasterises the image onto a small (~160 px) offscreen canvas.
//   2. Thresholds the alpha channel into a binary mask.
//   3. Traces the outer boundary of the largest opaque blob using
//      Moore-neighbour (8-connected) contour tracing.
//   4. Resamples the closed boundary polygon to exactly `count` points
//      spaced evenly by arc length, starting at the topmost pixel.
//   5. Returns coordinates normalised to 0..1 across the full square raster.
//      The raster letterboxes the image exactly like CSS object-contain in a
//      square box, so callers can overlay the points on the artwork rendered
//      with object-contain and they line up (and aspect ratio is preserved).
//
// Returns null in any non-browser or failure scenario so the caller can
// present its built-in star-polygon fallback.
// ---------------------------------------------------------------------------

const CANVAS_SIZE = 160; // pixel budget for the offscreen raster
const ALPHA_THRESHOLD = 50; // 0..255; pixels below this are transparent

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load an image from a URL and return an HTMLImageElement, or null on error. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cumulative arc-length prefix sums for a polygon (closed = last→first included). */
function arcLengths(pts: Point[]): number[] {
  const d: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    d.push(d[i - 1] + dist(pts[i - 1], pts[i]));
  }
  // close the loop
  d.push(d[d.length - 1] + dist(pts[pts.length - 1], pts[0]));
  return d;
}

// ---------------------------------------------------------------------------
// Mask helpers
// ---------------------------------------------------------------------------

/** Return true if the pixel at (x, y) in the mask is opaque. */
function isOpaque(mask: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return mask[y * w + x] === 1;
}

// ---------------------------------------------------------------------------
// Flood-fill to label the largest connected opaque blob
// ---------------------------------------------------------------------------

/**
 * BFS flood-fill from (sx, sy). Marks visited pixels in `labels` with `id`.
 * Returns the pixel count of the blob.
 */
function floodFill(
  mask: Uint8Array,
  labels: Int32Array,
  w: number,
  h: number,
  sx: number,
  sy: number,
  id: number,
): number {
  const queue: number[] = [sy * w + sx];
  labels[sy * w + sx] = id;
  let count = 0;

  while (queue.length > 0) {
    const idx = queue.pop()!;
    count++;
    const px = idx % w;
    const py = (idx / w) | 0;

    // 4-connected neighbours (enough for finding largest blob)
    const neighbours = [
      [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (mask[ni] === 1 && labels[ni] === 0) {
        labels[ni] = id;
        queue.push(ni);
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Moore-neighbour contour tracing (Jacob's stopping criterion)
// ---------------------------------------------------------------------------

// 8-connected clockwise neighbour offsets starting at direction 0 = right.
// Indices correspond to: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
const DIRS: Array<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/**
 * Trace the outer boundary of a blob identified by `blobId` in `labels`.
 * Uses the Moore-neighbour algorithm with Jacob's stopping criterion.
 * Returns an ordered list of boundary pixels (may be empty for tiny blobs).
 */
function traceBoundary(
  mask: Uint8Array,
  labels: Int32Array,
  w: number,
  h: number,
  blobId: number,
  startX: number,
  startY: number,
): Point[] {
  // Jacob's stopping criterion: stop when we revisit the start pixel coming
  // from the same direction as the first step.

  const boundary: Point[] = [];

  // Verify the start pixel belongs to our blob.
  if (labels[startY * w + startX] !== blobId) return boundary;

  boundary.push({ x: startX, y: startY });

  // Find the first background neighbour (Moore entry direction).
  // We scan clockwise from direction 4 (west) for a background pixel to
  // establish the initial backtrack direction.
  let backDir = 4; // "came from west" for the topmost-leftmost pixel
  // Actually: for the topmost pixel, the background is above it (direction 6=N).
  // Back-track direction = opposite of the direction we "entered" from = direction
  // of the background neighbour we check first. Convention: we scan CW from
  // backDir to find the next boundary pixel.
  backDir = 6; // N is background for topmost pixel; scan CW from N.

  let cx = startX;
  let cy = startY;
  let firstStep = true;

  // Safety cap: boundary can be at most w*h pixels long.
  const maxSteps = w * h + 1;
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    // Scan 8 neighbours CW from backDir to find the next boundary pixel.
    let found = false;
    for (let di = 1; di <= 8; di++) {
      const dir = (backDir + di) % 8;
      const [dx, dy] = DIRS[dir];
      const nx = cx + dx;
      const ny = cy + dy;

      if (isOpaque(mask, w, h, nx, ny) && labels[ny * w + nx] === blobId) {
        // Stop on the first return to the start pixel. (Direction-sensitive
        // stopping criteria can miss the return and loop the outline many
        // times, which would scatter the resampled dots out of order.)
        if (!firstStep && nx === startX && ny === startY) {
          return boundary;
        }

        // New boundary pixel.
        cx = nx;
        cy = ny;
        // The backtrack direction is opposite to the direction we arrived from.
        backDir = (dir + 4) % 8;
        boundary.push({ x: cx, y: cy });
        firstStep = false;
        found = true;
        break;
      }
    }

    if (!found) {
      // Isolated single pixel — nothing more to trace.
      return boundary;
    }
  }

  return boundary;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extract `count` evenly-spaced outline points from a Pokémon artwork image.
 *
 * @param imageUrl  URL returned by ARTWORK(id) — a local transparent-bg PNG.
 * @param count     Desired number of dot positions (caller passes 8 or 14).
 * @returns         Array of {x, y} in 0..1 (normalised to the full square
 *                  raster, object-contain geometry), or null on any failure.
 */
export async function extractOutlinePoints(
  imageUrl: string,
  count: number,
): Promise<Array<Point> | null> {
  // Guard: must be running in a browser with canvas support.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  // -------------------------------------------------------------------------
  // 1. Load image
  // -------------------------------------------------------------------------
  const img = await loadImage(imageUrl);
  if (!img || img.naturalWidth === 0) return null;

  // -------------------------------------------------------------------------
  // 2. Rasterise onto a small square canvas (preserve aspect ratio, centred)
  // -------------------------------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return null;

  const aspect = img.naturalWidth / img.naturalHeight;
  let dw: number, dh: number, dx: number, dy: number;
  if (aspect >= 1) {
    dw = CANVAS_SIZE;
    dh = Math.round(CANVAS_SIZE / aspect);
    dx = 0;
    dy = Math.round((CANVAS_SIZE - dh) / 2);
  } else {
    dh = CANVAS_SIZE;
    dw = Math.round(CANVAS_SIZE * aspect);
    dx = Math.round((CANVAS_SIZE - dw) / 2);
    dy = 0;
  }
  ctx2d.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx2d.drawImage(img, dx, dy, dw, dh);

  const imageData = ctx2d.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const { data, width: W, height: H } = imageData;

  // -------------------------------------------------------------------------
  // 3. Build binary alpha mask
  // -------------------------------------------------------------------------
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    mask[i] = data[i * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
  }

  // -------------------------------------------------------------------------
  // 4. Find the largest connected opaque blob via BFS
  // -------------------------------------------------------------------------
  const labels = new Int32Array(W * H); // 0 = unlabelled
  let blobCount = 0;
  const blobSizes: Map<number, number> = new Map();
  const blobTopLeft: Map<number, [number, number]> = new Map(); // topmost then leftmost pixel

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (mask[idx] === 1 && labels[idx] === 0) {
        blobCount++;
        const size = floodFill(mask, labels, W, H, x, y, blobCount);
        blobSizes.set(blobCount, size);
        blobTopLeft.set(blobCount, [x, y]); // first-encountered = topmost-leftmost
      }
    }
  }

  if (blobCount === 0) return null;

  // Pick the blob with the most pixels.
  let bestId = 1;
  let bestSize = 0;
  for (const [id, size] of blobSizes) {
    if (size > bestSize) { bestSize = size; bestId = id; }
  }

  const [topX, topY] = blobTopLeft.get(bestId)!;

  // -------------------------------------------------------------------------
  // 5. Trace the outer boundary with Moore-neighbour algorithm
  // -------------------------------------------------------------------------
  let boundary = traceBoundary(mask, labels, W, H, bestId, topX, topY);

  if (boundary.length < 3) return null; // degenerate result

  // -------------------------------------------------------------------------
  // 6. Resample the boundary polygon to `count` evenly-spaced points.
  //    Enforce minimum spacing; retry with fewer points if needed.
  // -------------------------------------------------------------------------
  const MIN_COUNT = 6;
  let targetCount = Math.max(MIN_COUNT, count);

  // Deduplicate consecutive identical boundary pixels (Moore trace can repeat).
  const deduped: Point[] = [boundary[0]];
  for (let i = 1; i < boundary.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (boundary[i].x !== prev.x || boundary[i].y !== prev.y) {
      deduped.push(boundary[i]);
    }
  }
  boundary = deduped;

  let result: Point[] = [];

  for (let attempt = 0; attempt < targetCount - MIN_COUNT + 1; attempt++) {
    const n = targetCount - attempt;
    if (n < MIN_COUNT) break;

    const lengths = arcLengths(boundary);
    const perimeter = lengths[lengths.length - 1];
    if (perimeter < 1) break;

    const step = perimeter / n;
    const minAllowed = step * 0.45;
    const pts: Point[] = [];

    // Walk around the boundary and pick the point at each multiple of `step`.
    let segIdx = 0;
    for (let k = 0; k < n; k++) {
      const target = k * step;
      // Advance segIdx until we're in the right segment.
      while (segIdx < lengths.length - 1 && lengths[segIdx + 1] < target) {
        segIdx++;
      }
      if (segIdx >= boundary.length) { segIdx = boundary.length - 1; }

      // Interpolate within the segment (handle the closing segment separately).
      const segStart = boundary[segIdx];
      const segEnd = segIdx + 1 < boundary.length ? boundary[segIdx + 1] : boundary[0];
      const segLen = lengths[segIdx + 1] - lengths[segIdx];

      let pt: Point;
      if (segLen < 0.001) {
        pt = { x: segStart.x, y: segStart.y };
      } else {
        const t = (target - lengths[segIdx]) / segLen;
        pt = {
          x: segStart.x + t * (segEnd.x - segStart.x),
          y: segStart.y + t * (segEnd.y - segStart.y),
        };
      }
      pts.push(pt);
    }

    // Check minimum spacing between consecutive resampled points.
    let tooClose = false;
    for (let i = 0; i < pts.length; i++) {
      const next = pts[(i + 1) % pts.length];
      if (dist(pts[i], next) < minAllowed) { tooClose = true; break; }
    }

    if (!tooClose || n <= MIN_COUNT) {
      result = pts;
      break;
    }
    // Retry with one fewer point.
  }

  if (result.length === 0) return null;

  // -------------------------------------------------------------------------
  // 7. Normalise to 0..1 across the full raster (object-contain geometry)
  // -------------------------------------------------------------------------
  return result.map((p) => ({
    x: Math.max(0, Math.min(1, p.x / W)),
    y: Math.max(0, Math.min(1, p.y / H)),
  }));
}
