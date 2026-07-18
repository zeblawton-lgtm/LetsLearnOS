// ---------------------------------------------------------------------------
// Child-friendly audio feedback.
//
// All cues are SYNTHESISED with the Web Audio API — no audio files are
// shipped or fetched, so feedback works fully offline on the kiosk with zero
// asset weight. Spanish pronunciation uses the browser SpeechSynthesis API
// (backed by espeak-ng, installed by scripts/install.sh) so it also works
// offline on the device.
//
// The AudioContext is created lazily on the first user gesture to satisfy
// browser autoplay policies.
// ---------------------------------------------------------------------------

// Persisted so the parent's Sounds toggle survives reloads and the nightly
// kiosk reboot — same pattern as the music mute in lib/music.ts.
const MUTE_KEY = "letslearn_sound_muted";

let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
export function isMuted() {
  return muted;
}

// Play a single tone. `type` shapes the timbre; gentle attack/decay envelope
// keeps everything soft for young ears.
function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  peak = 0.18,
) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, ac.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ac.currentTime + start + duration,
  );
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.02);
}

// Soft tap for button presses.
export function playTap() {
  if (muted) return;
  tone(330, 0, 0.08, "triangle", 0.1);
}

// Happy rising arpeggio for a correct answer.
export function playCorrect() {
  if (muted) return;
  [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.16, "sine", 0.2));
}

// Gentle, non-punishing two-note "try again" — never harsh for kids.
export function playWrong() {
  if (muted) return;
  tone(392, 0, 0.18, "triangle", 0.14);
  tone(311.13, 0.14, 0.22, "triangle", 0.14);
}

// Celebratory fanfare for finishing a module.
export function playFanfare() {
  if (muted) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, i * 0.12, 0.26, "sine", 0.22),
  );
  tone(1318.51, 0.5, 0.4, "sine", 0.18);
}

// SpeechSynthesis silently no-ops when the browser exposes zero voices (seen
// on some sandboxed/kiosk Chromium images) — no error, no sound, nothing to
// debug from. Log once so that failure mode is visible instead of looking
// identical to "everything is muted".
let loggedNoVoices = false;

// Speak text aloud (e.g. a Spanish word) using the offline speech engine.
export function speak(text: string, lang = "es-ES") {
  if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    if (window.speechSynthesis.getVoices().length === 0 && !loggedNoVoices) {
      loggedNoVoices = true;
      console.warn(
        "[sound] speechSynthesis.getVoices() is empty — the offline fallback voice will be silent until voices load.",
      );
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.85; // a little slower for learners
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is best-effort */
  }
}
