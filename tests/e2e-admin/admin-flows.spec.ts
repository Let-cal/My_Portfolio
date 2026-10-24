import { test, expect } from "./fixtures";

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
  await handle.focus();
  await handle.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await handle.press("ArrowUp");
  await expect(
    page.getByRole("status").filter({
      hasText: `Draggable item ${second} was moved over droppable area ${first}.`,
    }),
  ).toHaveCount(1);
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
    await expect(
      page.getByText("Không kết nối được máy chủ. Thay đổi chưa được lưu.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lưu", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("textbox", { name: "Tên chứng chỉ" }),
    ).toHaveValue(name);
    await expect(page).toHaveURL(new RegExp(`/admin/certificates/${id}$`));
    await context.setOffline(false);
    await expect(banner).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Tên chứng chỉ" }),
    ).toHaveValue(name);
    expect((await suite.read(id))[0].name).toBe(id);
    await suite.save();
    await expect.poll(async () => (await suite.read(id))[0]?.name).toBe(name);
  } finally {
    await context.setOffline(false);
  }
});
