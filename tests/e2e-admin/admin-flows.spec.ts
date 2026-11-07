import type { Page, Request as PlaywrightRequest } from "@playwright/test";
import {
  test,
  expect,
  FIGURES_LIST_REQUEST,
  FIGURES_SAVE_STATES,
} from "./fixtures";

// Real Auth, server actions, RLS, Postgres and private Realtime are mandatory.
// No test.skip, response replacement, route interception or Supabase mock.

test("local authentication, logout and anonymous/member denial", async ({
  page,
  suite,
}) => {
  await page.goto("/admin/certificates");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fcertificates$/);
  await suite.login(page);
  const ids = suite.settings.fixtures.certificateIds;
  const before = await Promise.all(ids.map((id) => suite.read(id)));
  expect(before.map((rows) => rows.length)).toEqual([1, 1]);
  expect(before.map((rows) => rows[0].published)).toEqual([false, false]);
  const publicId = "task4-certificate-public";
  const publicBefore = await suite.read(publicId);
  expect(publicBefore).toHaveLength(1);
  expect(publicBefore[0].published).toBe(true);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/certificates");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();

  const anonymous = { anonymous: true };
  const member = { access: await suite.login(page, "member") };
  for (const [index, access] of [anonymous, member].entries()) {
    for (const id of ids) expect(await suite.read(id, access)).toEqual([]);
    // Positive control: these exact identities can read the published target.
    expect(await suite.read(publicId, access)).toEqual(publicBefore);
    const probeId = suite.own(`denied-${index}`);
    const insert = await suite.api("/rest/v1/certificates", {
      ...access,
      method: "POST",
      data: {
        id: probeId,
        name: probeId,
        organization: "Synthetic denial probe issuer",
        issue_date: "2026-01-01",
        topic: "engineering",
        skills: [],
        description: {
          en: "Synthetic denial probe",
          ja: "テスト用",
          vi: "Dữ liệu kiểm thử",
        },
        published: true,
        sort_index: 0,
      },
    });
    expect(insert.status()).toBe(index === 0 ? 401 : 403);
    expect((await insert.json()).code).toBe("42501");
    expect(await suite.read(probeId)).toEqual([]);
    for (const [id, unchanged] of [
      ...ids.map((id, i) => [id, before[i]] as const),
      [publicId, publicBefore] as const,
    ]) {
      for (const method of ["PATCH", "DELETE"]) {
        if (id === publicId)
          expect(await suite.read(id, access)).toEqual(publicBefore);
        const response = await suite.api(`/rest/v1/certificates?id=eq.${id}`, {
          ...access,
          method,
          ...(method === "PATCH" ? { data: { name: probeId } } : {}),
        });
        // A policy may filter every row; a transport or JWT error is no proof.
        if (response.status() === 200)
          expect(await response.json()).toEqual([]);
        else {
          expect(response.status()).toBe(index === 0 ? 401 : 403);
          expect((await response.json()).code).toBe("42501");
        }
        // Full admin read includes timestamps and every other persisted column.
        expect(await suite.read(id)).toEqual(unchanged);
      }
    }
  }
  await page.goto("/admin/certificates");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu", exact: true }),
  ).toHaveCount(0);
});

test("certificate CRUD, public visibility and persisted keyboard ordering", async ({
  page,
  suite,
}) => {
  await suite.login(page);
  const first = suite.own("crud-a");
  const second = suite.own("crud-b");
  await suite.create(first);
  await suite.create(second);
  await suite.edit(first);
  const editedName = `${first} edited`;
  await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(editedName);
  await suite.save();
  await expect
    .poll(async () => (await suite.read(first))[0]?.name)
    .toBe(editedName);
  expect(await suite.read(first, { anonymous: true })).toEqual([]);
  await suite.row(first).getByRole("switch").check();
  await expect
    .poll(async () => (await suite.read(first, { anonymous: true }))[0]?.name)
    .toBe(editedName);
  await suite.row(first).getByRole("switch").uncheck();
  await expect
    .poll(async () => (await suite.read(first, { anonymous: true })).length)
    .toBe(0);
  await suite.list();

  const beforeFirst = (await suite.read(first))[0].sort_index;
  const beforeSecond = (await suite.read(second))[0].sort_index;
  expect(beforeSecond).toBeGreaterThan(beforeFirst);
  const handle = page.getByRole("button", {
    name: `Kéo để sắp xếp ${second}`,
    exact: true,
  });
  const moved = page.getByRole("status").filter({
    hasText: `Draggable item ${second} was moved over droppable area ${first}.`,
  });
  // A refresh of the list that lands mid-drag (a late Realtime change note from the visibility toggles above)
  // cancels the keyboard drag, so the move is never announced. Cancel and pick the row up again, at most three
  // times; the persisted order is still asserted below.
  let registered = false;
  for (let attempt = 0; attempt < 3 && !registered; attempt++) {
    await handle.focus();
    await handle.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await handle.press("ArrowUp");
    registered = await expect(moved)
      .toHaveCount(1, { timeout: 5_000 })
      .then(
        () => true,
        () => false,
      );
    if (!registered) {
      await handle.press("Escape");
      await expect(handle).not.toHaveAttribute("aria-pressed", "true");
    }
  }
  if (!registered) throw new Error("Keyboard reorder did not register");
  await handle.press("Space");
  await expect(page.getByText("Đã lưu thứ tự", { exact: true })).toBeVisible();
  await suite.list();
  await expect
    .poll(async () => {
      const a = (await suite.read(first))[0];
      const b = (await suite.read(second))[0];
      return b.sort_index < a.sort_index;
    })
    .toBe(true);
  await page.reload();
  await suite.list();
  await expect
    .poll(() =>
      page
        .locator('[id^="row-task4-crud-"]')
        .evaluateAll((rows) => rows.map((row) => row.id)),
    )
    .toEqual([`row-${second}`, `row-${first}`]);
  await suite.remove(first);
  await suite.remove(second);
});

test("a local draft survives reload, restores and clears after a real save", async ({
  page,
  suite,
}) => {
  await suite.login(page);
  const id = suite.own("draft");
  await suite.create(id);
  await suite.edit(id);
  const draftName = `${id} unsaved draft`;
  await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(draftName);
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const draft = localStorage.getItem(key);
        return draft ? JSON.parse(draft).values.name : null;
      }, `admin.draft.certificates.${id}`),
    )
    .toBe(draftName);
  expect((await suite.read(id))[0].name).toBe(id);
  // Accept the actual beforeunload prompt; do not inject a fabricated draft.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  const offered = page
    .getByRole("status")
    .filter({ hasText: "Có bản nháp chưa lưu" });
  await expect(offered).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Tên chứng chỉ" }),
  ).toHaveValue(id);
  await offered.getByRole("button", { name: "Khôi phục", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Tên chứng chỉ" }),
  ).toHaveValue(draftName);
  await suite.save();
  await expect
    .poll(async () => (await suite.read(id))[0]?.name)
    .toBe(draftName);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => localStorage.getItem(key),
        `admin.draft.certificates.${id}`,
      ),
    )
    .toBeNull();
});

test("two tabs receive real updates, retain conflicting edits and notice deletion", async ({
  page,
  context,
  suite,
}) => {
  await suite.login(page);
  const id = suite.own("realtime");
  await suite.create(id);
  const other = await context.newPage();
  await other.goto("/admin/certificates");
  await suite.list(other);
  await suite.realtimeReady(other);
  await suite.edit(id);
  const remoteName = `${id} remote`;
  await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(remoteName);
  await suite.save();
  // No refresh/focus trigger on the observing tab: only the real broadcast updates it.
  await expect(suite.row(id, other)).toContainText(remoteName);
  await suite.edit(id, other);
  await suite.realtimeReady(other);
  const localName = `${id} retained edit`;
  await other.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(localName);
  await suite.edit(id);
  const newerName = `${id} newer remote`;
  await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(newerName);
  await suite.save();
  const conflict = other
    .getByRole("status")
    .filter({ hasText: "Có bản mới hơn của mục này" });
  await expect(conflict).toBeVisible();
  await expect(
    other.getByRole("textbox", { name: "Tên chứng chỉ" }),
  ).toHaveValue(localName);
  await conflict
    .getByRole("button", { name: "Giữ bản của tôi", exact: true })
    .click();
  await expect(conflict).toHaveCount(0);
  await suite.save(other);
  await expect
    .poll(async () => (await suite.read(id))[0]?.name)
    .toBe(localName);
  await suite.edit(id, other);
  await other
    .getByRole("textbox", { name: "Tên chứng chỉ" })
    .fill(`${id} deletion draft`);
  await suite.realtimeReady(other);
  await expect(suite.row(id)).toContainText(localName);
  await suite.remove(id);
  await expect(
    other
      .getByRole("alert")
      .filter({ hasText: "Mục này đã bị xóa ở nơi khác" }),
  ).toBeVisible();
  await expect(
    other.getByRole("textbox", { name: "Tên chứng chỉ" }),
  ).toHaveValue(`${id} deletion draft`);
  await other.close();
});

test("cross-tab signout preserves the form and real reauthentication resumes saving", async ({
  page,
  context,
  suite,
}) => {
  await suite.login(page);
  const id = suite.own("session");
  await suite.create(id);
  await suite.edit(id);
  const retained = `${id} retained after signout`;
  await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(retained);
  const other = await context.newPage();
  await other.goto("/admin/certificates");
  await suite.list(other);
  await other.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(other).toHaveURL(/\/admin\/login$/);
  const expired = page.getByRole("dialog", {
    name: "Phiên đăng nhập đã hết hạn",
    exact: true,
  });
  await expect(expired).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Tên chứng chỉ", includeHidden: true }),
  ).toHaveValue(retained);
  expect((await suite.read(id))[0].name).toBe(id);
  const [reauth] = await Promise.all([
    page.waitForEvent("popup"),
    expired.getByRole("link", { name: "Đăng nhập lại", exact: true }).click(),
  ]);
  await suite.login(reauth);
  // SIGNED_IN resumes the session; returning to the editor also verifies it on
  // focus. Do not race an optional button click against automatic dialog closure.
  await page.bringToFront();
  await expect(expired).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Tên chứng chỉ" }),
  ).toHaveValue(retained);
  await suite.save();
  await expect.poll(async () => (await suite.read(id))[0]?.name).toBe(retained);
  await reauth.close();
  await other.close();
});

test("network simulation: offline edits recover and save to the real backend", async ({
  page,
  context,
  suite,
}) => {
  await suite.login(page);
  const id = suite.own("offline");
  await suite.create(id);
  await suite.edit(id);
  const name = `${id} offline edit`;
  await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(name);
  try {
    await context.setOffline(true);
    const banner = page.getByRole("status").filter({ hasText: "Mất kết nối" });
    await expect(banner).toBeVisible();
    await Promise.all([
      page.waitForEvent(
        "requestfailed",
        async (request) =>
          request.url() ===
            `${suite.settings.appOrigin}/admin/certificates/${id}` &&
          request.method() === "POST" &&
          !!(await request.headerValue("next-action")),
      ),
      page.getByRole("button", { name: "Lưu", exact: true }).click(),
    ]);
    const networkToast = page.getByText(
      "Không kết nối được máy chủ. Thay đổi chưa được lưu.",
      { exact: true },
    );
    await expect(networkToast).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lưu", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("textbox", { name: "Tên chứng chỉ" }),
    ).toHaveValue(name);
    await expect(page).toHaveURL(new RegExp(`/admin/certificates/${id}$`));
    // Sonner intentionally pauses expiry while hovered. The preceding Save
    // click can leave the pointer beneath the new bottom-right toast. Move away
    // normally, then require natural expiry before clicking the Save bar again.
    await page.mouse.move(0, 0);
    await context.setOffline(false);
    await expect(banner).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Tên chứng chỉ" }),
    ).toHaveValue(name);
    expect((await suite.read(id))[0].name).toBe(id);
    await expect(networkToast).toHaveCount(0);
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await suite.list();
    await expect.poll(async () => (await suite.read(id))[0]?.name).toBe(name);
  } finally {
    await context.setOffline(false);
  }
});

// A valid 1x1 PNG, uploaded through the real Storage policy as the image figure.
const FIGURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("project figures: an uploaded image and a Mermaid diagram are saved and counted on the public archive", async ({
  page,
  suite,
}) => {
  test.setTimeout(150_000);
  await suite.login(page);
  const projectId = suite.settings.fixtures.projectId;
  expect((await suite.readProject()).media).toEqual([]);
  suite.touchFigures();
  const edit = `/admin/projects/${projectId}`;
  await page.goto(edit);
  await expect(
    page.getByRole("heading", { name: `Sửa ${projectId}`, exact: true }),
  ).toBeVisible();
  const field = (path: string) => page.locator(`[id="field-media.${path}"]`);

  // Image: uploaded from the add-image dialog, then captioned.
  await page.getByRole("button", { name: "Thêm ảnh", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm ảnh" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Tải ảnh mới lên").setInputFiles({
    name: "task4-figure.png",
    mimeType: "image/png",
    buffer: FIGURE_PNG,
  });
  await expect(dialog).toHaveCount(0);
  await field("0.caption.en").fill("Task4 image figure");
  await field("0.alt.en").fill("A one-pixel synthetic image.");

  // Diagram: a syntax error shows the parser message; the fixed source previews.
  await page.getByRole("button", { name: "Thêm sơ đồ", exact: true }).click();
  await field("1.caption.en").fill("Task4 diagram figure");
  await field("1.alt.en").fill("Box A points to box B.");
  const preview = page.getByRole("img", { name: "Xem trước sơ đồ" });
  await expect(preview).toHaveAttribute("data-stale", "false", {
    timeout: 30_000,
  });
  await field("1.source").fill("flowchart LR; A-->");
  const parser = page.getByRole("alert").filter({ hasText: "Parse error" });
  await expect(parser).toBeVisible({ timeout: 30_000 });
  await expect(preview).toHaveAttribute("data-stale", "true");
  await field("1.source").fill("flowchart LR; A-->B");
  await expect(parser).toHaveCount(0, { timeout: 30_000 });
  await expect(preview).toHaveAttribute("data-stale", "false");

  // Save renders light and dark, uploads both, and the server re-checks them.
  // Toasts close after a few seconds, so the save's signals are sampled while the redirect is awaited; a failure
  // names the strongest one seen (a fixed word, never the form content).
  const seen = new Set<(typeof FIGURES_SAVE_STATES)[number]>();
  let watching = true;
  const watcher = (async () => {
    while (watching) {
      seen.add(await figuresSaveState(page).catch(() => "idle" as const));
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  })();
  // Whether the browser asked for the list page after the save (a non-prefetch request to /admin/projects) and
  // how that request ended: tells a router that never navigated from a list page that never answered.
  let listRequest: (typeof FIGURES_LIST_REQUEST)[number] = "none";
  const isListNavigation = (request: PlaywrightRequest) =>
    new URL(request.url()).pathname === "/admin/projects" &&
    !request.headers()["next-router-prefetch"];
  const onRequest = (request: PlaywrightRequest) => {
    if (isListNavigation(request) && listRequest === "none")
      listRequest = "pending";
  };
  const onFinished = (request: PlaywrightRequest) => {
    if (isListNavigation(request)) listRequest = "done";
  };
  const onFailed = (request: PlaywrightRequest) => {
    if (isListNavigation(request))
      listRequest = failureKind(request.failure()?.errorText);
  };
  page.on("request", onRequest);
  page.on("requestfinished", onFinished);
  page.on("requestfailed", onFailed);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/admin\/projects\?highlight=/, {
      timeout: 60_000,
    });
  } catch {
    watching = false;
    await watcher;
    seen.add(await figuresSaveState(page));
    const state = FIGURES_SAVE_STATES.find((s) => seen.has(s)) ?? "idle";
    throw new Error(
      `Figures save did not finish: ${state === "saved-no-redirect" ? `${state}-${listRequest}` : state}`,
    );
  } finally {
    watching = false;
    await watcher;
    page.off("request", onRequest);
    page.off("requestfinished", onFinished);
    page.off("requestfailed", onFailed);
  }
  const media = (await suite.readProject()).media;
  expect(media.map((f) => [f.kind, (f.caption as { en: string }).en])).toEqual([
    ["image", "Task4 image figure"],
    ["diagram", "Task4 diagram figure"],
  ]);
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const storage = escapeRegExp(
    `${suite.settings.apiUrl}/storage/v1/object/public/media`,
  );
  expect(String(media[0].url)).toMatch(
    new RegExp(`^${storage}/image/[a-z0-9]+-task4-figure\\.webp$`),
  );
  const image = await suite.api(
    String(media[0].url).slice(suite.settings.apiUrl.length),
  );
  expect(image.headers()["content-type"]).toMatch(/^image\/webp/);
  for (const theme of ["Light", "Dark"]) {
    const url = String(media[1][`svg${theme}`]);
    expect(url).toMatch(
      new RegExp(
        `^${storage}/diagram/${escapeRegExp(projectId)}-[a-z0-9-]+-${theme.toLowerCase()}-[0-9a-f]{8}\\.svg$`,
      ),
    );
    const svg = await suite.api(url.slice(suite.settings.apiUrl.length));
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
    expect(await svg.text()).toMatch(/^\s*<svg[\s>]/);
  }
  expect(media[1]).toMatchObject({ source: "flowchart LR; A-->B" });
  expect(Number(media[1].themeVersion)).toBeGreaterThan(0);

  // Reload: both figures are listed in their saved order.
  await page.goto(edit);
  await expect(page.getByTestId("figure-caption")).toHaveText([
    "Task4 image figure",
    "Task4 diagram figure",
  ]);

  // The public archive row counts the two figures once the content tag refreshes.
  const chip = page.locator(`[id="row-${projectId}"] [data-figures]`);
  await expect(async () => {
    await page.goto("/en/projects");
    await expect(chip).toHaveText("図 2", { timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
});

/** A failed list request as a fixed word, from Chromium's net error code (never the URL or the text itself). */
function failureKind(
  errorText: string | undefined,
): (typeof FIGURES_LIST_REQUEST)[number] {
  if (!errorText) return "failed";
  if (errorText.includes("ERR_ABORTED")) return "failed-aborted";
  if (/ERR_CONNECTION_(RESET|CLOSED|REFUSED)/.test(errorText))
    return "failed-connection";
  if (errorText.includes("ERR_EMPTY_RESPONSE")) return "failed-empty";
  if (errorText.includes("TIMED_OUT")) return "failed-timeout";
  return "failed";
}

/**
 * Where a project save stopped when its redirect did not come: a fixed word (FIGURES_SAVE_STATES) read from what
 * the form shows, never the form content itself (the failure report keeps only this word).
 */
async function figuresSaveState(
  page: Page,
): Promise<(typeof FIGURES_SAVE_STATES)[number]> {
  if (
    await page
      .getByRole("dialog", { name: "Phiên đăng nhập đã hết hạn" })
      .count()
  )
    return "session-dialog";
  if (await page.locator("[data-sonner-toast][data-type='error']").count())
    return "error-toast";
  if (await page.locator("[aria-invalid='true']").count()) return "invalid";
  // Inside the form only: Next.js keeps its own route announcer (role="alert") on every page.
  if (await page.locator("form").getByRole("alert").count()) return "alert";
  if (await page.locator("[data-sonner-toast][data-type='success']").count())
    return "saved-no-redirect";
  if (await page.getByRole("button", { name: "Đang lưu…" }).count())
    return "saving";
  return "idle";
}
