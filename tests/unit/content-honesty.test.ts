import { describe, expect, it } from "vitest";
import seed from "@/content/seed.json";

const BANNED_WORDS = [
  "spearheaded",
  "orchestrated",
  "leveraged",
  "synergy",
  "synergistic",
  "foster",
  "transformative",
  "seamless",
  "seamlessly",
  "cutting-edge",
  "dynamic",
  "passionate",
  "results-driven",
  "results-oriented",
  "empower",
  "game-changer",
  "multifaceted",
  "unwavering",
  "thought leader",
  "at the intersection of",
  "proven track record",
  "deep dive",
];

describe("content honesty", () => {
  const text = JSON.stringify(seed);
  const lower = text.toLowerCase();

  it.each([
    ["3+ years", /3\+\s*years/i],
    ["AI Engineer", /AI Engineer/],
    ["Present", /\bPresent\b/],
    ["percent figures", /\d+(\.\d+)?\s?%/],
    ["phone number", /\+84|0964|09648/],
  ])("does not contain %s", (_label, pattern) => {
    expect(text).not.toMatch(pattern);
  });

  it.each(BANNED_WORDS)("does not use the banned word %s", (word) => {
    expect(lower).not.toContain(word.toLowerCase());
  });
});
