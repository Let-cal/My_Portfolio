import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ range: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({ order: () => ({ order: () => ({ range: m.range }) }) }),
    }),
  }),
}));
import { listItems } from "@/lib/admin/data";
it("reads beyond the first page for exhaustive media reference checks", async () => {
  m.range.mockImplementation(async (start: number) => ({
    error: null,
    data:
      start === 0
        ? Array.from({ length: 100 }, (_, i) => ({
            id: `a${i}`,
            title: `Project ${i}`,
            sort_index: i,
            published: false,
          }))
        : [
            {
              id: "last",
              title: "Hidden project",
              sort_index: 100,
              published: false,
              poster_url:
                "https://project.supabase.co/storage/v1/object/public/media/used.png",
            },
          ],
  }));
  const rows = await listItems("projects", true);
  expect(rows).toHaveLength(101);
  expect(rows.at(-1)).toMatchObject({
    id: "last",
    posterUrl: expect.stringContaining("used.png"),
  });
  expect(m.range).toHaveBeenCalledWith(100, 199);
});
it("fails the exhaustive reference read if any later page fails", async () => {
  m.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 100 }, (_, i) => ({
        id: `a${i}`,
        title: `Project ${i}`,
        sort_index: i,
        published: false,
      })),
      error: null,
    })
    .mockResolvedValueOnce({
      data: null,
      error: { message: "page unavailable" },
    });
  await expect(listItems("projects", true)).rejects.toThrow("page unavailable");
});
