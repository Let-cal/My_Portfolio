"use client";

import { TextVeil } from "./TextVeil";
import {
  useAvoidTracking,
  useChapterTracking,
  useCtaTracking,
  useFeedClicks,
  usePointerTracking,
} from "./use-scene-input";

/** Desktop-only measurements and interaction code load alongside the live scene. */
export default function LiveSceneInput({ enabled }: { enabled: boolean }) {
  useChapterTracking(enabled);
  usePointerTracking(enabled);
  useAvoidTracking(enabled);
  useCtaTracking(enabled);
  useFeedClicks(enabled);
  return <TextVeil />;
}
