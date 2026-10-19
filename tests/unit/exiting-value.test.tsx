import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useExitingValue } from "@/components/fx/use-exiting-value";

describe("text presence copies", () => {
  it("keeps outgoing copies until their animation ends, including rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useExitingValue(value, false),
      { initialProps: { value: "developer" } },
    );
    expect(result.current.leaving).toEqual([]);
    rerender({ value: "lead" });
    rerender({ value: "pm" });
    expect(result.current.leaving.map((frame) => frame.value)).toEqual([
      "developer",
      "lead",
    ]);
    act(() => result.current.finish(0));
    expect(result.current.leaving.map((frame) => frame.value)).toEqual([
      "lead",
    ]);
    expect(result.current.current.value).toBe("pm");
  });

  it("does not keep animated copies when motion is reduced", () => {
    const { result, rerender } = renderHook(
      ({ value, reduced }) => useExitingValue(value, reduced),
      { initialProps: { value: "a", reduced: false } },
    );
    rerender({ value: "b", reduced: false });
    expect(result.current.leaving).toHaveLength(1);
    rerender({ value: "b", reduced: true });
    expect(result.current.leaving).toEqual([]);
  });
});
