#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// warm-tts.ts — Pre-warm optional OpenAI narration for static phrases.
//
// Usage:
//   tsx scripts/warm-tts.ts [--dry-run]
//
// --dry-run prints per-module counts + 3 sample phrases each, no network.
//
// Real warm (run on/against a configured kiosk; its backend owns the disk cache):
//   NARRATION_API_URL=http://127.0.0.1:8765 tsx scripts/warm-tts.ts
//
// Each phrase is requested as GET {NARRATION_API_URL}/api/tts?text=...&lang=... —
// exactly what the frontend sends — so warming and runtime share one cache.
// The response's X-Tts-Cache header ("hit"/"miss"/"legacy") feeds the stats.
// ---------------------------------------------------------------------------

import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Resolve the repo root relative to this script.
// scripts/ is one level under artifacts/letslearnos/.
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC = join(__dirname, "../src");

// ---------------------------------------------------------------------------
// Pure content + lib imports via relative paths (avoids @/ alias under tsx).
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { math3YoQuestions } = await import(join(SRC, "content/math-3yo.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { math5YoQuestions } = await import(join(SRC, "content/math-5yo.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { spanishQuestions } = await import(join(SRC, "content/spanish.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { pokedex } = await import(join(SRC, "content/pokedex.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { SUN, PLANETS, DWARF_PLANETS } = await import(join(SRC, "content/space.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { continents } = await import(join(SRC, "content/world-globe.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { allRocketSpokenLines } = await import(join(SRC, "content/rocket.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { allSeekSpokenLines } = await import(join(SRC, "content/waldo-scenes.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { allSearchSpokenLines } = await import(join(SRC, "content/search.ts")) as any;

// The REAL builders and transforms the app uses — single source of truth.
// spoken-math.ts only has type-only "@/" imports (erased at runtime) and
// pronounce.ts uses relative imports, so both load fine under plain tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { POKEMON_POOL, getSpokenQuestion } =
  await import(join(SRC, "lib/spoken-math.ts")) as any;
// math-explain.ts is the post-ADR explanation engine (template-only). Its
// "@/" imports are type-only (erased at runtime), so it loads under tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { getExplanation } = await import(join(SRC, "content/math-explain.ts")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { spokenName, spokenText } = await import(join(SRC, "lib/pronounce.ts")) as any;

// ---------------------------------------------------------------------------
// Phrase record
// ---------------------------------------------------------------------------
interface Phrase {
  text: string;
  lang: "en" | "es" | "auto";
  module: string;
}

// ---------------------------------------------------------------------------
// Build phase lists
// ---------------------------------------------------------------------------

function buildMathPhrases(): Phrase[] {
  const phrases: Phrase[] = [];

  // --- 3yo questions (getSpokenQuestion, is3yo=true, wrapped in spokenText)
  for (const q of math3YoQuestions) {
    for (const pokemon of POKEMON_POOL) {
      const raw = getSpokenQuestion(q, pokemon.name, true);
      const text = spokenText(raw);
      phrases.push({ text, lang: "en", module: "math" });
    }
  }

  // --- 3yo explanations (getExplanation spokenLines, wrapped in spokenText)
  for (const q of math3YoQuestions) {
    for (const line of getExplanation(q, true).spokenLines as string[]) {
      phrases.push({ text: spokenText(line), lang: "en", module: "math" });
    }
  }

  // --- 5yo questions (getSpokenQuestion, is3yo=false, wrapped in spokenText)
  for (const q of math5YoQuestions) {
    const raw = getSpokenQuestion(q, "", false);
    const text = spokenText(raw);
    // word problems already carry their own Pokemon name; add/sub/multiply have no name
    phrases.push({ text, lang: "en", module: "math" });
  }

  // --- 5yo explanations (getExplanation spokenLines, wrapped in spokenText)
  for (const q of math5YoQuestions) {
    for (const line of getExplanation(q, false).spokenLines as string[]) {
      phrases.push({ text: spokenText(line), lang: "en", module: "math" });
    }
  }

  return phrases;
}

function buildSpanishPhrases(): Phrase[] {
  const phrases: Phrase[] = [];
  for (const q of spanishQuestions) {
    // Spanish word (es, no transform)
    if (q.spanishWord) {
      phrases.push({ text: q.spanishWord as string, lang: "es", module: "spanish" });
    }
    // Wrong-answer: spokenName(q.answer) with lang "auto"
    const spoken = spokenName(q.answer as string);
    phrases.push({ text: spoken, lang: "auto", module: "spanish" });
  }
  return phrases;
}

function buildTracingPhrases(): Phrase[] {
  const phrases: Phrase[] = [];
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const NUMBERS = "0123456789".split("");
  const SHAPE_NAMES = ["Circle", "Square", "Triangle", "Star", "Heart"];

  for (const l of LETTERS) {
    phrases.push({ text: `Letter ${l}!`, lang: "en", module: "tracing" });
  }
  for (const n of NUMBERS) {
    phrases.push({ text: `Number ${n}!`, lang: "en", module: "tracing" });
  }
  for (const s of SHAPE_NAMES) {
    phrases.push({ text: `${s}!`, lang: "en", module: "tracing" });
  }
  return phrases;
}

function buildDotsPhrases(): Phrase[] {
  const phrases: Phrase[] = [];
  // Count utterances 1..14
  for (let i = 1; i <= 14; i++) {
    phrases.push({ text: String(i), lang: "en", module: "dots" });
  }
  // Reveal phrases: It's <spokenName>!
  const DOTS_POOL_IDS = [25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 54, 129, 35, 52, 113, 175];
  for (const id of DOTS_POOL_IDS) {
    const entry = (pokedex as Array<{ id: number; name: string }>).find((e) => e.id === id);
    const name = entry?.name ?? `#${id}`;
    const text = `It's ${spokenName(name)}!`;
    phrases.push({ text, lang: "en", module: "dots" });
  }
  return phrases;
}

function buildMatchPhrases(): Phrase[] {
  const MATCH_POOL_IDS = [25, 1, 4, 7, 133, 39, 143, 6, 131, 151, 52, 54, 129, 35, 94, 175];
  const phrases: Phrase[] = [];
  for (const id of MATCH_POOL_IDS) {
    const entry = (pokedex as Array<{ id: number; name: string }>).find((e) => e.id === id);
    const name = entry?.name ?? `#${id}`;
    const text = spokenName(name);
    phrases.push({ text, lang: "en", module: "match" });
  }
  return phrases;
}

function buildColoringPhrases(): Phrase[] {
  const PALETTE = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Black", "White"];
  return PALETTE.map((name) => ({ text: name, lang: "en" as const, module: "coloring" }));
}

function buildRegionsPhrases(): Phrase[] {
  const HABITATS = [
    { name: "Rainforest", climate: "Warm and wet" },
    { name: "Desert", climate: "Hot and dry" },
    { name: "Ocean Reef", climate: "Warm water" },
    { name: "Mountain", climate: "Cool and windy" },
    { name: "Grassland", climate: "Sunny and open" },
    { name: "Snowy Land", climate: "Cold and icy" },
  ];
  return HABITATS.map((h) => ({
    text: spokenText(`${h.name}. ${h.climate}.`),
    lang: "en" as const,
    module: "regions",
  }));
}

// Space (planets + dwarf planets) — must byte-match speakBody in
// src/pages/space.tsx and src/pages/space-dwarfs.tsx: `${name}. ${facts.join(" ")}`.
function buildSpacePhrases(): Phrase[] {
  const bodies = [SUN, ...PLANETS, ...DWARF_PLANETS] as Array<{
    name: string;
    facts: string[];
  }>;
  return bodies.map((body) => ({
    text: `${body.name}. ${body.facts.join(" ")}`,
    lang: "en" as const,
    module: "space",
  }));
}

// Geography (continent globe) — must byte-match sayContinent/sayCountry/
// sayRegion in src/pages/geography.tsx, plus the globe-error fallback line.
function buildGeographyPhrases(): Phrase[] {
  interface Region {
    name: string;
    fact: string;
  }
  interface Country {
    name: string;
    capital: string;
    fact: string;
    regions: Region[];
  }
  interface Continent {
    name: string;
    fact: string;
    countries: Country[];
  }

  const phrases: Phrase[] = [];
  for (const continent of continents as Continent[]) {
    phrases.push({
      text: `${continent.name}. ${continent.fact}`,
      lang: "en",
      module: "geography",
    });
    for (const country of continent.countries) {
      phrases.push({
        text: `${country.name}. Capital: ${country.capital}. ${country.fact}`,
        lang: "en",
        module: "geography",
      });
      for (const region of country.regions) {
        phrases.push({
          text: `${region.name}. ${region.fact}`,
          lang: "en",
          module: "geography",
        });
      }
    }
  }
  // The globe fallback card (geography.tsx) is narrated too when WebGL
  // can't start — same phrase must be warm.
  phrases.push({
    text: "The spinning globe is resting right now. You can still tap the buttons to hear all about the world.",
    lang: "en",
    module: "geography",
  });
  return phrases;
}

// Rocket Launch — content/rocket.ts's allRocketSpokenLines() is the single
// source of truth src/pages/rocket.tsx itself prefetches from on mount, so
// reusing it here (rather than re-deriving the strings) guarantees this
// stays byte-identical to every speakText/speakSequence call on the page.
function buildRocketPhrases(): Phrase[] {
  return (allRocketSpokenLines() as string[]).map((text) => ({
    text,
    lang: "en" as const,
    module: "rocket",
  }));
}

// Hide & Seek — content/waldo-scenes.ts's allSeekSpokenLines() is the single
// source of truth src/pages/seek.tsx itself prefetches from on mount (same
// contract as rocket's), so warming it guarantees byte-identical coverage.
function buildSeekPhrases(): Phrase[] {
  return (allSeekSpokenLines() as string[]).map((text) => ({
    text,
    lang: "en" as const,
    module: "seek",
  }));
}

// Hidden Search — content/search.ts's allSearchSpokenLines() enumerates the
// find/found lines for every generated target plus each page's hint_text
// (src/pages/search.tsx prefetches the same list on mount — same byte-
// stability contract as rocket/seek).
function buildSearchPhrases(): Phrase[] {
  return (allSearchSpokenLines() as string[]).map((text) => ({
    text,
    lang: "en" as const,
    module: "search",
  }));
}

async function buildPokedexPhrases(): Promise<Phrase[]> {
  const artworkDir = join(__dirname, "../public/sprites/official-artwork");
  const files = await readdir(artworkDir);
  const bundledIds = new Set(
    files
      .filter((f) => f.endsWith(".png"))
      .map((f) => parseInt(f.replace(".png", ""), 10))
      .filter((n) => !Number.isNaN(n)),
  );
  const phrases: Phrase[] = [];
  for (const entry of pokedex as Array<{ id: number; name: string }>) {
    if (bundledIds.has(entry.id)) {
      phrases.push({ text: spokenName(entry.name), lang: "en", module: "pokedex" });
    }
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// Dedup: cache key is lang + "\n" + text  (mirrors the frontend tts.ts logic)
// ---------------------------------------------------------------------------
function dedup(phrases: Phrase[]): Phrase[] {
  const seen = new Set<string>();
  const out: Phrase[] = [];
  for (const p of phrases) {
    const key = `${p.lang}\n${p.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Network: request each phrase through the kiosk api-server (ADR-022)
// ---------------------------------------------------------------------------
const NARRATION_BASE =
  process.env.NARRATION_API_URL ?? "http://127.0.0.1:8765";
const REQUEST_TIMEOUT_MS = 60_000;

async function postPhrase(p: Phrase): Promise<{ ok: boolean; cached: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${NARRATION_BASE}/api/tts?text=${encodeURIComponent(p.text)}&lang=${p.lang}`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    // Drain the body so keep-alive sockets recycle cleanly.
    await res.arrayBuffer().catch(() => undefined);
    if (!res.ok) return { ok: false, cached: false };
    return { ok: true, cached: res.headers.get("x-tts-cache") === "hit" };
  } catch {
    clearTimeout(timer);
    return { ok: false, cached: false };
  }
}

async function warmPhrase(p: Phrase): Promise<{ ok: boolean; cached: boolean }> {
  const first = await postPhrase(p);
  if (first.ok) return first;
  // one retry
  return postPhrase(p);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Build all phrase lists
  const mathPhrases = dedup(buildMathPhrases());
  const spanishPhrases = dedup(buildSpanishPhrases());
  const tracingPhrases = dedup(buildTracingPhrases());
  const dotsPhrases = dedup(buildDotsPhrases());
  const matchPhrases = dedup(buildMatchPhrases());
  const coloringPhrases = dedup(buildColoringPhrases());
  const regionsPhrases = dedup(buildRegionsPhrases());
  const pokedexPhrases = dedup(await buildPokedexPhrases());
  const spacePhrases = dedup(buildSpacePhrases());
  const geographyPhrases = dedup(buildGeographyPhrases());
  const rocketPhrases = dedup(buildRocketPhrases());
  const seekPhrases = dedup(buildSeekPhrases());
  const searchPhrases = dedup(buildSearchPhrases());

  const allPhrases = dedup([
    ...mathPhrases,
    ...spanishPhrases,
    ...tracingPhrases,
    ...dotsPhrases,
    ...matchPhrases,
    ...coloringPhrases,
    ...regionsPhrases,
    ...pokedexPhrases,
    ...spacePhrases,
    ...geographyPhrases,
    ...rocketPhrases,
    ...seekPhrases,
    ...searchPhrases,
  ]);

  const modules = [
    { name: "math", phrases: mathPhrases },
    { name: "spanish", phrases: spanishPhrases },
    { name: "tracing", phrases: tracingPhrases },
    { name: "dots", phrases: dotsPhrases },
    { name: "match", phrases: matchPhrases },
    { name: "coloring", phrases: coloringPhrases },
    { name: "regions", phrases: regionsPhrases },
    { name: "pokedex", phrases: pokedexPhrases },
    { name: "space", phrases: spacePhrases },
    { name: "geography", phrases: geographyPhrases },
    { name: "rocket", phrases: rocketPhrases },
    { name: "seek", phrases: seekPhrases },
    { name: "search", phrases: searchPhrases },
  ];

  if (dryRun) {
    console.log("\n=== warm-tts DRY RUN ===\n");
    for (const mod of modules) {
      console.log(`[${mod.name}] ${mod.phrases.length} phrases`);
      for (const p of mod.phrases.slice(0, 3)) {
        console.log(`  (${p.lang}) "${p.text}"`);
      }
    }
    console.log(`\nGRAND TOTAL (deduplicated): ${allPhrases.length} phrases`);
    console.log(`\nTo warm the cache, run (against the kiosk's api-server):`);
    console.log(`  NARRATION_API_URL=http://127.0.0.1:8765 tsx scripts/warm-tts.ts`);
    return;
  }

  // ---- Real warm ----
  const total = allPhrases.length;
  let done = 0;
  let failed = 0;
  let cacheHits = 0;
  const times: number[] = [];

  console.log(`\nWarming ${total} phrases against ${NARRATION_BASE} ...\n`);

  for (const p of allPhrases) {
    const t0 = Date.now();
    const result = await warmPhrase(p);
    const elapsed = Date.now() - t0;
    times.push(elapsed);
    done++;
    if (result.ok) {
      if (result.cached) cacheHits++;
    } else {
      failed++;
      console.error(`  FAIL [${p.lang}] "${p.text}"`);
    }

    if (done % 10 === 0 || done === total) {
      const pct = Math.round((done / total) * 100);
      const hitPct = Math.round((cacheHits / done) * 100);
      const avgMs = times.slice(-20).reduce((s, v) => s + v, 0) / Math.min(times.length, 20);
      const etaSec = Math.round(((total - done) * avgMs) / 1000);
      const etaStr = etaSec > 60
        ? `${Math.floor(etaSec / 60)}m${etaSec % 60}s`
        : `${etaSec}s`;
      console.log(
        `  ${done}/${total} (${pct}%) | cache-hits ${hitPct}% | ETA ${done < total ? etaStr : "done"} | failed ${failed}`,
      );
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  Total:      ${total}`);
  console.log(`  Succeeded:  ${total - failed}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Cache hits: ${cacheHits} (${Math.round((cacheHits / total) * 100)}%)`);

  if (failed / total > 0.1) {
    console.error(`\nERROR: ${failed}/${total} phrases failed (>${Math.round((failed / total) * 100)}% > 10% threshold).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
