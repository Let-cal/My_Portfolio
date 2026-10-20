import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/ja",
}));

import { RoleProvider, useRole } from "@/components/site/RoleProvider";

function Probe() {
  const { role, setRole } = useRole();
  return (
    <>
      <output data-testid="role">{role}</output>
      <button onClick={() => setRole("techlead")}>tl</button>
      <button onClick={() => setRole("fullstack")}>fs</button>
    </>
  );
}

describe("RoleProvider", () => {
  beforeEach(() => {
    replace.mockClear();
    search.value = "";
    window.history.replaceState(null, "", "/ja");
  });

  it("defaults to fullstack and reads ?role= from the URL", async () => {
    search.value = "role=pm";
    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );
    expect((await screen.findByTestId("role")).textContent).toBe("pm");
  });

  it("falls back to fullstack for an unknown role", async () => {
    search.value = "role=cto";
    await act(async () => {
      render(
        <RoleProvider>
          <Probe />
        </RoleProvider>,
      );
    });
    expect(screen.getByTestId("role").textContent).toBe("fullstack");
  });

  it("setRole updates immediately and rewrites the URL without scrolling, keeping other params and the hash", async () => {
    window.history.replaceState(null, "", "/ja?utm=x#skills");
    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );
    await userEvent.click(screen.getByText("tl"));
    expect(screen.getByTestId("role").textContent).toBe("techlead");
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/ja?utm=x&role=techlead#skills");
    expect(replace).not.toHaveBeenCalled();
  });

  it("setRole(default) drops the role param", async () => {
    window.history.replaceState(null, "", "/ja?role=pm");
    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );
    await userEvent.click(screen.getByText("fs"));
    expect(window.location.pathname + window.location.search).toBe("/ja");
  });
});
