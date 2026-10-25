import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminAccess = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("@/lib/admin/access", () => ({ getAdminAccess }));
vi.mock("@/lib/admin/data", () => ({ getAdminContent: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect,
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { AdminContentColumn } =
  await import("@/components/admin/AdminContentColumn");
const { AdminAccessProvider } =
  await import("@/components/admin/AdminAccessProvider");

beforeEach(() => {
  getAdminAccess.mockReset();
  redirect.mockClear();
});

async function providedKind(): Promise<string> {
  const tree = (await AdminContentColumn({ children: null })) as ReactElement<{
    kind: string;
  }>;
  expect(isValidElement(tree)).toBe(true);
  expect(tree.type).toBe(AdminAccessProvider);
  return tree.props.kind;
}

describe("AdminContentColumn", () => {
  it("sends someone with no admin access to the login page instead of a read-only shell", async () => {
    getAdminAccess.mockResolvedValue(null);
    await expect(AdminContentColumn({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT /admin/login",
    );
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("gives the reviewer the read-only screens", async () => {
    getAdminAccess.mockResolvedValue({ kind: "reviewer", email: "r@x.test" });
    expect(await providedKind()).toBe("reviewer");
  });

  it("gives the admin the full screens", async () => {
    getAdminAccess.mockResolvedValue({ kind: "admin", email: "a@x.test" });
    expect(await providedKind()).toBe("admin");
  });
});
