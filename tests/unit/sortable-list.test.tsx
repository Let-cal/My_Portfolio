import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SortableList } from "@/components/admin/SortableList";

const list = (
  <SortableList
    items={[{ id: "a" }, { id: "b" }]}
    onReorder={() => {}}
    renderItem={(item, handle) => (
      <div>
        {handle}
        {item.id}
      </div>
    )}
  />
);

describe("SortableList", () => {
  it("hydrates without attribute mismatches", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(list);
    document.body.append(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, list, { onRecoverableError: (e) => recoverable.push(e) });
    });
    const mismatch = errors.mock.calls.some((args) => String(args[0]).includes("didn't match"));
    errors.mockRestore();
    expect(mismatch).toBe(false);
    expect(recoverable).toEqual([]);
  });
});
