import { useMediaQuery } from "./use-media-query";

/** True on devices that can hover with a precise pointer (mouse/trackpad). Pointer effects are off otherwise. */
export function usePointerFine(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}
