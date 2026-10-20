import { useCallback, useSyncExternalStore } from "react";

export type SoundKind = "drop" | "click";

export interface SoundEngine {
  play(kind: SoundKind): void;
  setEnabled(v: boolean): void;
  readonly enabled: boolean;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

/** One sine blip: pitch sweeps from `from` to `to` Hz while the gain rises fast and decays exponentially. */
function blip(
  ctx: AudioContext,
  {
    from,
    to,
    peak,
    duration,
  }: { from: number; to: number; peak: number; duration: number },
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

const SOUNDS: Record<SoundKind, Parameters<typeof blip>[1]> = {
  // A water drop: a quick downward sweep.
  drop: { from: 620, to: 190, peak: 0.12, duration: 0.22 },
  // A soft tick.
  click: { from: 880, to: 700, peak: 0.07, duration: 0.05 },
};

/**
 * Synthesised UI sounds (WebAudio sine + envelope, no asset files). Off by default; the AudioContext is only
 * created on the first `play` after being enabled, which also satisfies browsers' autoplay policy because
 * enabling comes from a user gesture.
 */
export function createSoundEngine(): SoundEngine {
  let enabled = false;
  let ctx: AudioContext | null = null;

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(v: boolean) {
      enabled = v;
    },
    play(kind) {
      if (!enabled) return;
      try {
        if (!ctx) {
          const Ctor = getAudioContextCtor();
          if (!Ctor) return;
          ctx = new Ctor();
        }
        if (ctx.state === "suspended") void ctx.resume();
        blip(ctx, SOUNDS[kind]);
      } catch {
        // Audio is decoration; never let it break the page.
      }
    },
  };
}

const STORAGE_KEY = "sound";
const listeners = new Set<() => void>();
let engine: SoundEngine | null = null;

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Sound preference stored in `localStorage['sound']` ("on" | "off", default off), shared by every consumer. */
export function useSound() {
  const enabled = useSyncExternalStore(subscribe, readStored, () => false);

  const setEnabled = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "on" : "off");
    } catch {
      // Storage blocked: the preference lasts for this page view only.
    }
    (engine ??= createSoundEngine()).setEnabled(v);
    listeners.forEach((l) => l());
  }, []);

  const play = useCallback((kind: SoundKind) => {
    engine ??= createSoundEngine();
    engine.setEnabled(readStored());
    engine.play(kind);
  }, []);

  return { enabled, setEnabled, play };
}
