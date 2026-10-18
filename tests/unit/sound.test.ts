import { afterEach, describe, expect, it, vi } from "vitest";
import { createSoundEngine } from "@/components/fx/sound";

function fakeAudio() {
  const created: unknown[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  class FakeAudioContext {
    currentTime = 0;
    state = "running";
    destination = {};
    constructor() {
      created.push(this);
    }
    resume = vi.fn(() => Promise.resolve());
    createGain = vi.fn(() => ({ gain: param(), connect: vi.fn() }));
    createOscillator = vi.fn(() => ({
      type: "sine",
      frequency: param(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return created;
}

describe("sound engine", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is disabled by default", () => {
    expect(createSoundEngine().enabled).toBe(false);
  });

  it("does not create an AudioContext while disabled", () => {
    const created = fakeAudio();
    const engine = createSoundEngine();
    engine.play("drop");
    engine.play("click");
    expect(created).toHaveLength(0);
  });

  it("creates one AudioContext lazily once enabled and synthesises with a sine oscillator", () => {
    const created = fakeAudio();
    const engine = createSoundEngine();
    engine.setEnabled(true);
    expect(engine.enabled).toBe(true);
    expect(created).toHaveLength(0);
    engine.play("drop");
    engine.play("click");
    expect(created).toHaveLength(1);
    const ctx = created[0] as { createOscillator: ReturnType<typeof vi.fn> };
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("does not throw when Web Audio is unavailable", () => {
    const engine = createSoundEngine();
    engine.setEnabled(true);
    expect(() => engine.play("click")).not.toThrow();
  });
});
