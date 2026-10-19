import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthList } from "@/components/admin/HealthList";
import type { HealthIssue } from "@/lib/admin/health";

const issue = (over: Partial<HealthIssue>): HealthIssue => ({
  id: over.kind ?? "x",
  severity: "warning",
  kind: "orphan-skill",
  message: "m",
  href: "/admin",
  ...over,
});

describe("HealthList", () => {
  it("lists errors first, each as a link to where it is fixed", () => {
    render(
      <HealthList
        issues={[
          issue({
            id: "a",
            severity: "info",
            kind: "hidden-items",
            message: "2 chứng chỉ đang ẩn",
            href: "/admin/certificates",
          }),
          issue({
            id: "b",
            severity: "error",
            kind: "missing-cv",
            message: "Thiếu CV",
            href: "/admin/roles",
          }),
          issue({
            id: "c",
            severity: "warning",
            message: "12 skill chưa gắn",
            href: "/admin/skills?filter=orphan",
          }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Thiếu CV"),
      expect.stringContaining("12 skill chưa gắn"),
      expect.stringContaining("2 chứng chỉ đang ẩn"),
    ]);
    expect(links[1].getAttribute("href")).toBe("/admin/skills?filter=orphan");
  });

  it("says everything is fine when there is nothing to fix", () => {
    render(<HealthList issues={[]} />);
    expect(screen.getByText(/Mọi thứ ổn/)).toBeTruthy();
  });
});
