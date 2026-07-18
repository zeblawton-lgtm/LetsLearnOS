// Optional OpenAI narration proxy.
//
// The browser calls only this same-origin route. OPENAI_API_KEY stays in the
// backend environment and is never serialized to the frontend. When OpenAI is
// not configured or cannot be reached, this route returns 503 so the frontend
// can use its offline SpeechSynthesis fallback.
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Logger } from "pino";

const router = Router();

const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_MS = 5 * 60_000;
const MAX_TEXT_LENGTH = 400;
const LANGUAGES = new Set(["en", "es", "auto"]);

interface OpenAiTtsConfig {
  credential: string;
  model: string;
  voice: string;
  voiceEs: string;
  instructions: string;
  instructionsEs: string;
  cacheDir: string;
  organization?: string;
  project?: string;
}

type TtsIdentity = Pick<
  OpenAiTtsConfig,
  "model" | "voice" | "voiceEs" | "instructions" | "instructionsEs"
>;

function readConfig(): OpenAiTtsConfig {
  const credential =
    process.env["OPENAI_ACCESS_TOKEN"]?.trim() ||
    process.env["OPENAI_API_KEY"]?.trim() ||
    "";
  return {
    credential,
    model: process.env["OPENAI_TTS_MODEL"]?.trim() || "gpt-4o-mini-tts",
    voice: process.env["OPENAI_TTS_VOICE"]?.trim() || "marin",
    voiceEs:
      process.env["OPENAI_TTS_VOICE_ES"]?.trim() ||
      process.env["OPENAI_TTS_VOICE"]?.trim() ||
      "marin",
    instructions:
      process.env["OPENAI_TTS_INSTRUCTIONS"]?.trim() ||
      "Speak warmly, clearly, and encouragingly for a young learner.",
    instructionsEs:
      process.env["OPENAI_TTS_INSTRUCTIONS_ES"]?.trim() ||
      "Speak in clear, friendly Spanish at a comfortable pace for a young learner.",
    cacheDir:
      process.env["OPENAI_TTS_CACHE_DIR"]?.trim() ||
      path.join(os.tmpdir(), "letslearnos-openai-tts"),
    organization: process.env["OPENAI_ORGANIZATION_ID"]?.trim() || undefined,
    project: process.env["OPENAI_PROJECT_ID"]?.trim() || undefined,
  };
}

function voiceFor(lang: string, config: TtsIdentity): string {
  return lang === "es" ? config.voiceEs : config.voice;
}

function instructionsFor(lang: string, config: TtsIdentity): string {
  return lang === "es" ? config.instructionsEs : config.instructions;
}

export function ttsCacheKey(
  text: string,
  lang: string,
  config: TtsIdentity,
): string {
  const identity = [
    config.model,
    voiceFor(lang, config),
    instructionsFor(lang, config),
    lang,
    text,
  ].join("\n");
  return crypto.createHash("sha256").update(identity).digest("hex");
}

let openAiUnavailableUntil = 0;
let requestOpenAi: typeof fetch = globalThis.fetch;

/** Test hook; production always uses the platform fetch implementation. */
export function setTtsFetchForTests(replacement?: typeof fetch) {
  requestOpenAi = replacement ?? globalThis.fetch;
}

/** Test hook: clear negative caching and in-flight state between cases. */
export function resetTtsRuntimeState() {
  openAiUnavailableUntil = 0;
  inFlight.clear();
}

function isTimeoutAbort(err: unknown): boolean {
  return err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError");
}

async function synthesize(
  text: string,
  lang: string,
  config: OpenAiTtsConfig,
): Promise<Buffer> {
  if (!config.credential) {
    throw new Error("OpenAI narration is not configured");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.credential}`,
    "Content-Type": "application/json",
  };
  if (config.organization) headers["OpenAI-Organization"] = config.organization;
  if (config.project) headers["OpenAI-Project"] = config.project;

  let response: Response;
  try {
    response = await requestOpenAi(OPENAI_SPEECH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        input: text,
        voice: voiceFor(lang, config),
        instructions: instructionsFor(lang, config),
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (!isTimeoutAbort(err)) {
      openAiUnavailableUntil = Date.now() + RETRY_MS;
    }
    throw err;
  }

  if (!response.ok) {
    openAiUnavailableUntil = Date.now() + RETRY_MS;
    throw new Error(`OpenAI Speech API failed with status ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function writeCache(file: string, audio: Buffer, cacheDir: string) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, audio);
  fs.renameSync(temporary, file);
}

interface TtsResult {
  audio: Buffer;
  cache: "hit" | "miss";
}

async function obtain(
  text: string,
  lang: string,
  config: OpenAiTtsConfig,
): Promise<TtsResult> {
  const key = ttsCacheKey(text, lang, config);
  const file = path.join(config.cacheDir, `${key}.mp3`);

  // Previously synthesized phrases remain available if credentials or the
  // network are temporarily unavailable.
  if (fs.existsSync(file)) {
    return { audio: fs.readFileSync(file), cache: "hit" };
  }

  if (!config.credential || Date.now() < openAiUnavailableUntil) {
    throw new Error("OpenAI narration is unavailable");
  }

  const audio = await synthesize(text, lang, config);
  writeCache(file, audio, config.cacheDir);
  return { audio, cache: "miss" };
}

// Collapse concurrent requests for the same configured utterance into one API
// call. The configuration identity is included through ttsCacheKey.
const inFlight = new Map<string, Promise<TtsResult>>();

router.get("/tts", async (req, res) => {
  const text = String(req.query["text"] ?? "").trim();
  const lang = String(req.query["lang"] ?? "en");
  if (!text || text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `text is required (max ${MAX_TEXT_LENGTH} chars)` });
    return;
  }
  if (!LANGUAGES.has(lang)) {
    res.status(400).json({ error: "lang must be one of: en, es, auto" });
    return;
  }

  const config = readConfig();
  const flightKey = ttsCacheKey(text, lang, config);
  const log: Logger = req.log;
  try {
    let pending = inFlight.get(flightKey);
    if (!pending) {
      pending = obtain(text, lang, config).finally(() => {
        inFlight.delete(flightKey);
      });
      inFlight.set(flightKey, pending);
    }
    const { audio, cache } = await pending;
    res
      .set("Content-Type", "audio/mpeg")
      .set("Cache-Control", "no-store")
      .set("X-Tts-Cache", cache)
      .send(audio);
  } catch (err) {
    log.debug({ err }, "OpenAI narration unavailable; browser fallback will be used");
    res.status(503).json({ error: "Narration unavailable" });
  }
});

export default router;
