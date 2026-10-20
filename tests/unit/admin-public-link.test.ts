import { describe, expect, it } from "vitest";
import { publicAnchor, publicUrl } from "@/lib/admin/public-link";

describe("publicAnchor", () => {
  it("points at the item where the site has one, else its section", () => {
    expect(publicAnchor("experiences", "skg-coa")).toBe("exp-skg-coa");
    expect(publicAnchor("projects", "siteplus")).toBe("proj-siteplus");
    expect(publicAnchor("education", "fpt-university")).toBe(
      "edu-fpt-university",
    );
    expect(publicAnchor("certificates", "jlpt")).toBe("certificates");
    expect(publicAnchor("activities", "x")).toBe("certificates");
    expect(publicAnchor("skills", "react")).toBe("skills");
    expect(publicAnchor("why_cards", "x")).toBe("why");
  });

  it("builds the link on the site this admin runs on", () => {
    expect(
      publicUrl("projects", "siteplus", "https://preview.vercel.app"),
    ).toBe("https://preview.vercel.app/en#proj-siteplus");
  });
});
