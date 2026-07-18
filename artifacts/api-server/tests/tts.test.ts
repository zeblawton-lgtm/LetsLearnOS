import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test, { after, before, beforeEach } from "node:test";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.ADMIN_AUTH_SECRET = "test-admin-auth-secret";
process.env.DATABASE_URL = "postgres://test:test@localhost:1/letslearnos_test";
process.env.OPENAI_API_KEY = "test-openai-key";
delete process.env.OPENAI_ACCESS_TOKEN;
process.env.OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
process.env.OPENAI_TTS_VOICE = "marin";
process.env.OPENAI_TTS_VOICE_ES = "coral";
process.env.OPENAI_TTS_INSTRUCTIONS = "Speak warmly for a young learner.";
process.env.OPENAI_TTS_INSTRUCTIONS_ES = "Speak clearly in Spanish.";
process.env.OPENAI_TTS_CACHE_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "letslearnos-openai-tts-test-"),
);

const MP3 = Buffer.from("ID3fake-mp3-bytes-for-test");
let synthCalls = 0;
let failRequests = false;

interface RecordedRequest {
  url: string;
  headers: Headers;
  body: {
    model: string;
    input: string;
    voice: string;
    instructions: string;
    response_format: string;
  };
}

const requests: RecordedRequest[] = [];

const mockFetch: typeof fetch = async (input, init) => {
  if (failRequests) throw new TypeError("simulated network failure");
  synthCalls += 1;
  requests.push({
    url: String(input),
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)) as RecordedRequest["body"],
  });
  return new Response(MP3, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
};

const {
  resetTtsRuntimeState,
  setTtsFetchForTests,
  ttsCacheKey,
} = await import("../src/routes/tts");
const { default: app } = await import("../src/app");

let baseUrl = "";
let server: ReturnType<typeof app.listen>;

before(async () => {
  setTtsFetchForTests(mockFetch);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

beforeEach(() => {
  failRequests = false;
  process.env.OPENAI_API_KEY = "test-openai-key";
  delete process.env.OPENAI_ACCESS_TOKEN;
  resetTtsRuntimeState();
});

after(async () => {
  setTtsFetchForTests();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  fs.rmSync(process.env.OPENAI_TTS_CACHE_DIR!, { recursive: true, force: true });
});

const keyConfig = {
  model: "gpt-4o-mini-tts",
  voice: "marin",
  voiceEs: "coral",
  instructions: "Speak warmly for a young learner.",
  instructionsEs: "Speak clearly in Spanish.",
};

test("ttsCacheKey is deterministic and configuration-aware", () => {
  assert.equal(
    ttsCacheKey("hola", "es", keyConfig),
    ttsCacheKey("hola", "es", keyConfig),
  );
  assert.notEqual(
    ttsCacheKey("hola", "es", keyConfig),
    ttsCacheKey("hola", "en", keyConfig),
  );
  assert.notEqual(
    ttsCacheKey("hola", "en", keyConfig),
    ttsCacheKey("hola", "en", { ...keyConfig, voice: "cedar" }),
  );
});

test("GET /tts uses OpenAI and serves repeats from disk cache", async () => {
  const callsBefore = synthCalls;
  const first = await fetch(`${baseUrl}/tts?text=hello%20there&lang=en`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("content-type")?.includes("audio/mpeg"), true);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("x-tts-cache"), "miss");
  assert.deepEqual(Buffer.from(await first.arrayBuffer()), MP3);
  assert.equal(synthCalls, callsBefore + 1);

  const request = requests.at(-1)!;
  assert.equal(request.url, "https://api.openai.com/v1/audio/speech");
  assert.equal(request.headers.get("authorization"), "Bearer test-openai-key");
  assert.equal(request.body.model, "gpt-4o-mini-tts");
  assert.equal(request.body.voice, "marin");
  assert.equal(request.body.instructions, "Speak warmly for a young learner.");
  assert.equal(request.body.response_format, "mp3");

  const second = await fetch(`${baseUrl}/tts?text=hello%20there&lang=en`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("x-tts-cache"), "hit");
  assert.deepEqual(Buffer.from(await second.arrayBuffer()), MP3);
  assert.equal(synthCalls, callsBefore + 1);
});

test("GET /tts selects the configured Spanish voice and instructions", async () => {
  const response = await fetch(`${baseUrl}/tts?text=manzana&lang=es`);
  assert.equal(response.status, 200);
  const request = requests.at(-1)!;
  assert.equal(request.body.voice, "coral");
  assert.equal(request.body.instructions, "Speak clearly in Spanish.");
});

test("GET /tts accepts a short-lived access token", async () => {
  process.env.OPENAI_ACCESS_TOKEN = "test-workload-token";
  const response = await fetch(`${baseUrl}/tts?text=token%20request&lang=en`);
  assert.equal(response.status, 200);
  assert.equal(
    requests.at(-1)!.headers.get("authorization"),
    "Bearer test-workload-token",
  );
});

test("GET /tts validates text and language", async () => {
  assert.equal((await fetch(`${baseUrl}/tts`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/tts?text=hi&lang=de`)).status, 400);
  assert.equal(
    (await fetch(`${baseUrl}/tts?text=${"a".repeat(401)}&lang=en`)).status,
    400,
  );
});

test("GET /tts returns 503 without a key while cached audio remains usable", async () => {
  const warm = await fetch(`${baseUrl}/tts?text=cached%20phrase&lang=en`);
  assert.equal(warm.status, 200);
  const callsBefore = synthCalls;

  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_ACCESS_TOKEN;
  const missing = await fetch(`${baseUrl}/tts?text=uncached%20phrase&lang=en`);
  assert.equal(missing.status, 503);
  assert.equal(synthCalls, callsBefore);

  const cached = await fetch(`${baseUrl}/tts?text=cached%20phrase&lang=en`);
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get("x-tts-cache"), "hit");
});

test("GET /tts negative-caches a provider outage and recovers", async () => {
  failRequests = true;
  const callsBefore = synthCalls;
  const down = await fetch(`${baseUrl}/tts?text=provider%20down&lang=en`);
  assert.equal(down.status, 503);

  failRequests = false;
  const stillDown = await fetch(`${baseUrl}/tts?text=still%20down&lang=en`);
  assert.equal(stillDown.status, 503);
  assert.equal(synthCalls, callsBefore);

  resetTtsRuntimeState();
  const recovered = await fetch(`${baseUrl}/tts?text=recovered&lang=en`);
  assert.equal(recovered.status, 200);
  assert.equal(synthCalls, callsBefore + 1);
});
