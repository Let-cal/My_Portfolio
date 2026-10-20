import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { HealthBadge } from "@/components/admin/HealthBadge";

const content = contentSchema.parse(seed);

describe("HealthBadge", () => {
  it("shows the number of errors and warnings", async () => {
    render(await HealthBadge({ load: async () => content }));
    expect(screen.getByLabelText(/mục cần chú ý/).textContent).toMatch(/^\d+$/);
  });

  it("renders nothing when content cannot be loaded, so the admin still works", async () => {
    expect(
      await HealthBadge({
        load: async () => {
          throw new Error("db down");
        },
      }),
    ).toBeNull();
    expect(await HealthBadge({ load: async () => null })).toBeNull();
  });
});
