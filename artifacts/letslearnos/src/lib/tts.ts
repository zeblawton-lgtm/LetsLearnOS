// ---------------------------------------------------------------------------
// Voice narration (ADR-003).
//
// The frontend talks only to the same-origin backend proxy at /api/tts. When a
// server administrator configured OpenAI narration, the proxy returns generated
// audio; otherwise this module falls back to the browser's offline
// SpeechSynthesis voice. API credentials never enter browser code.
// ---------------------------------------------------------------------------
import { isMuted, speak as speakFallback } from "@/lib/sound";
import { setSpeechDucking } from "@/lib/music";

export type SpeechLang = "en" | "es" | "auto";

export interface Utterance {
  text: string;
  lang: SpeechLang;
}

const MAX_CACHE = 150;
const cache = new Map<string, string>(); // "lang\ntext" -> object URL
const pending = new Map<string, Promise<string>>(); // in-flight dedup

// Bail out before the backend's provider timeout so a slow network never leaves
// a child waiting in silence. The browser fallback starts immediately while the
// backend request can still populate its disk cache for a later attempt.
const FETCH_TIMEOUT_MS = 25_000;

let el: HTMLAudioElement | null = null;
let generation = 0;

// The TTS clips come out quiet while the bundled music is mastered loud, so
// narration is routed through a Web Audio gain stage (with a compressor to
// catch clipping). An <audio> element alone caps at volume 1.0.
const VOICE_GAIN = 1.8;
let boostCtx: AudioContext | null = null;

function routeThroughBooster(audio: HTMLAudioElement) {
  if (boostCtx) {
    if (boostCtx.state === "suspended") void boostCtx.resume().catch(() => {});
    return;
  }
  try {
    boostCtx = new AudioContext();
    const source = boostCtx.createMediaElementSource(audio);
    const gain = boostCtx.createGain();
    gain.gain.value = VOICE_GAIN;
    const compressor = boostCtx.createDynamicsCompressor();
    source.connect(gain);
    gain.connect(compressor);
    compressor.connect(boostCtx.destination);
    if (boostCtx.state === "suspended") void boostCtx.resume().catch(() => {});
  } catch {
    // Booster is best-effort; plain element output keeps working if the
    // context can't be created.
    boostCtx = null;
  }
}

function fallbackLang(lang: SpeechLang): string {
  return lang === "es" ? "es-ES" : "en-US";
}

async function fetchUtterance(text: string, lang: SpeechLang): Promise<string> {
  const key = `${lang}\n${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let inFlight = pending.get(key);
  if (!inFlight) {
    inFlight = (async () => {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`tts request failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());

      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          URL.revokeObjectURL(cache.get(oldest)!);
          cache.delete(oldest);
        }
      }
      cache.set(key, url);
      return url;
    })().finally(() => pending.delete(key));
    pending.set(key, inFlight);
  }
  return inFlight;
}

// Quietly warm the caches (backend disk mp3 + frontend object URLs) so
// narration starts instantly when a question appears. Serial on purpose —
// narration requests are serialized to avoid unnecessary provider bursts. It
// stops after the first failure; the speak path still uses SpeechSynthesis.
export async function prefetch(parts: Utterance[]): Promise<void> {
  for (const part of parts) {
    const text = part.text.trim();
    if (!text) continue;
    try {
      await fetchUtterance(text, part.lang);
    } catch {
      return;
    }
  }
}

function playUrl(url: string): Promise<void> {
  if (!el) el = new Audio();
  routeThroughBooster(el);
  const audio = el;
  audio.src = url;
  audio.currentTime = 0;
  return new Promise((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.onpause = () => resolve(); // stopSpeaking() pauses mid-utterance
    void audio.play().catch(() => resolve());
  });
}

// Cancel any current and queued narration.
export function stopSpeaking() {
  generation += 1;
  setSpeechDucking(false);
  if (el) {
    el.onended = null;
    el.pause();
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* best-effort */
    }
  }
}

// Speak utterances in order, cancelling whatever was playing before.
export async function speakSequence(parts: Utterance[]): Promise<void> {
  if (isMuted() || typeof window === "undefined") return;
  stopSpeaking();
  const gen = generation;

  // Pull the background music down while the voice speaks (menus narrate on
  // the Pokédex/Regions screens). Released when the sequence finishes; a
  // newer sequence/stop owns the duck state after a generation bump.
  setSpeechDucking(true);
  try {
    for (const part of parts) {
      const text = part.text.trim();
      if (!text || gen !== generation) return;
      try {
        const url = await fetchUtterance(text, part.lang);
        if (gen !== generation) return;
        await playUrl(url);
      } catch {
        if (gen !== generation) return;
        // Offline fallback (fire-and-forget, no sequencing).
        speakFallback(text, fallbackLang(part.lang));
      }
    }
  } finally {
    if (gen === generation) setSpeechDucking(false);
  }
}

export async function speakText(text: string, lang: SpeechLang = "en"): Promise<void> {
  return speakSequence([{ text, lang }]);
}
