// ---------------------------------------------------------------------------
// Background music manager.
//
// Plays an optional, separately licensed local soundtrack. The public source
// tree includes no music files; failed local loads remain silent.
//
// Autoplay policy: playback can only begin after a user gesture, so the first
// scene is started from the profile-tap handler (see SessionContext).
// ---------------------------------------------------------------------------

const BASE: string =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env
      ?.BASE_URL) ||
  "/";
const root = BASE.endsWith("/") ? BASE : BASE + "/";

// Background music plays only on menu screens; learning modules are silent so
// voice narration is clear, and module completion plays the jingle (ADR-005).
export type Scene = "menu";

// Optional asset-pack filenames under public/audio.
const SCENES: Record<Scene, string[]> = {
  menu: ["menu-1", "menu-2"],
};

const MUTE_KEY = "letslearn_music_muted";

let bg: HTMLAudioElement | null = null;
let jingle: HTMLAudioElement | null = null;
let scene: Scene | null = null;
let playlist: string[] = [];
let idx = 0;
// Keep music well under the narration: the bundled tracks are mastered loud
// while the TTS clips are quiet.
let volume = 0.2;
let muted = readMuted();

// Ducking state: the jingle and active narration each pull the background
// music down further. Recomputed by applyBgVolume().
let jingleDucking = false;
let speechDucking = false;

function applyBgVolume() {
  if (!bg) return;
  let v = volume;
  if (jingleDucking) v *= 0.4;
  if (speechDucking) v *= 0.25;
  bg.volume = v;
}

// Called by lib/tts.ts while narration is playing so the voice always sits
// on top of the music.
export function setSpeechDucking(active: boolean) {
  speechDucking = active;
  applyBgVolume();
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function track(name: string): string {
  return `${root}audio/${name}.mp3`;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function bgEl(): HTMLAudioElement {
  if (!bg) {
    bg = new Audio();
    bg.preload = "auto";
    bg.addEventListener("ended", playNext);
    applyBgVolume();
  }
  return bg;
}

function playNext() {
  if (!playlist.length) return;
  idx = (idx + 1) % playlist.length;
  const a = bgEl();
  a.src = track(playlist[idx]);
  a.loop = playlist.length === 1;
  if (!muted) void a.play().catch(() => {});
}

// The completion tracks are full-length songs, not short stings — they must
// be stopped explicitly whenever the app moves on, or they keep playing
// under the next screen.
function stopJingle() {
  if (jingle) {
    jingle.pause();
    jingle.currentTime = 0;
  }
  jingleDucking = false;
  applyBgVolume(); // un-duck
}

// Switch background music to a scene's playlist. Idempotent per scene.
export function playScene(s: Scene) {
  if (s === scene) {
    if (!muted && bg && bg.paused) void bg.play().catch(() => {});
    return;
  }
  stopJingle();
  scene = s;
  playlist = shuffle(SCENES[s]);
  idx = 0;
  const a = bgEl();
  a.src = track(playlist[0]);
  a.loop = playlist.length === 1;
  a.currentTime = 0;
  if (!muted) void a.play().catch(() => {});
}

// Play a short celebratory jingle over ducked background music.
export function playJingle(
  name = "celebration",
) {
  if (muted) return;
  if (!jingle) {
    jingle = new Audio();
    jingle.volume = Math.min(1, volume + 0.25);
    jingle.addEventListener("ended", () => {
      jingleDucking = false;
      applyBgVolume();
    });
  }
  jingleDucking = true;
  applyBgVolume(); // duck
  jingle.src = track(name);
  jingle.currentTime = 0;
  void jingle.play().catch(() => {});
}

export function stop() {
  scene = null;
  stopJingle();
  if (bg) {
    bg.pause();
    bg.currentTime = 0;
  }
}

export function setMusicMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (muted) {
    if (bg) bg.pause();
    stopJingle();
  } else if (scene) {
    if (bg && bg.paused) void bg.play().catch(() => {});
  }
}

export function isMusicMuted(): boolean {
  return muted;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  applyBgVolume();
}
