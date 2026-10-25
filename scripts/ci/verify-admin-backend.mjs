import assert from "node:assert/strict";
import { assertLocalSupabase } from "./local-supabase.mjs";
import { backendFailure } from "./backend-progress.mjs";
import {
  isHistoryDenied,
  isPrivateSchemaDenied,
  isRealtimeJoinDenied,
  isRestoreDenied,
  isStorageUploadDenied,
} from "./backend-denial.mjs";

function subscribe(channel, expectDenial = false) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Local realtime subscription timed out")),
      15000,
    );
    channel.subscribe((status, error) => {
      if (
        !["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)
      )
        return;
      clearTimeout(timer);
      if (
        expectDenial
          ? isRealtimeJoinDenied(status, error)
          : status === "SUBSCRIBED"
      )
        resolve();
      else reject(new Error("Unexpected local realtime subscription result"));
    });
  });
}

function localClientOptions(origin) {
  return {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        if (
          new URL(
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          ).origin !== origin
        )
          throw new Error("Nonlocal integration request denied");
        return fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
      },
    },
  };
}

/** Real local Auth/RLS/Storage/Realtime checks. No service-role client or mock transport. */
export async function verifyAdminBackend(fixture, anonKey) {
  const origin = assertLocalSupabase(fixture.apiUrl);
  const { createClient } = await import("@supabase/supabase-js");
  const options = localClientOptions(origin);
  const admin = createClient(origin, anonKey, options),
    member = createClient(origin, anonKey, options),
    reviewer = createClient(origin, anonKey, options),
    anonymous = createClient(origin, anonKey, options);
  const clients = [admin, member, reviewer, anonymous];
  const authLabels = new Map([
    [admin, "auth-admin"],
    [member, "auth-member"],
    [reviewer, "auth-reviewer"],
  ]);
  const sessions = new Map();
  let checks = 0;
  let checkpoint = "bootstrap";
  try {
    for (const [client, identity] of [
      [admin, fixture.admin],
      [member, fixture.member],
      [reviewer, fixture.reviewer],
    ]) {
      checkpoint = authLabels.get(client);
      const login = await client.auth.signInWithPassword(identity);
      assert.equal(login.error, null);
      assert.ok(login.data.user);
      assert.ok(login.data.session?.access_token);
      sessions.set(client, login.data.session);
      checks++;
    }
    checkpoint = "access-kind";
    for (const [client, kind] of [
      [admin, "admin"],
      [reviewer, "reviewer"],
      [member, null],
    ]) {
      const access = await client.rpc("admin_access_kind");
      assert.equal(access.error, null);
      assert.equal(access.data, kind);
      checks++;
    }
    const target = fixture.fixtures.certificateIds[0];
    checkpoint = "hidden-admin";
    const adminRows = await admin
      .from("certificates")
      .select("id")
      .eq("id", target);
    assert.equal(adminRows.error, null);
    assert.equal(adminRows.data.length, 1);
    checks++;
    for (const client of [anonymous, member]) {
      checkpoint = client === anonymous ? "hidden-anonymous" : "hidden-member";
      const hidden = await client
        .from("certificates")
        .select("id")
        .eq("id", target);
      assert.equal(hidden.error, null);
      assert.deepEqual(hidden.data, []);
      checks++;
    }
    checkpoint = "hidden-reviewer";
    const reviewerRows = await reviewer
      .from("certificates")
      .select("id")
      .eq("id", target);
    assert.equal(reviewerRows.error, null);
    assert.equal(reviewerRows.data.length, 1);
    checks++;
    for (const client of [member, reviewer]) {
      checkpoint =
        client === member ? "insert-member-denial" : "insert-reviewer-denial";
      const inserted = await client.from("certificates").insert({
        id: "test-item-denied",
        name: "Denied",
        organization: "Synthetic issuer",
        issue_date: "2026-01-01",
        topic: "engineering",
        description: { en: "Denied" },
      });
      assert.equal(inserted.error?.code, "42501");
      checks++;
    }
    // A visible row isolates write authorization from hidden-row SELECT filtering.
    // Keep fixture.certificateIds reserved for the two hidden browser fixtures.
    const publicTarget = "task4-certificate-public";
    checkpoint = "public-admin";
    const before = await admin
      .from("certificates")
      .select("*")
      .eq("id", publicTarget)
      .single();
    assert.equal(before.error, null);
    assert.equal(before.data.id, publicTarget);
    assert.equal(before.data.published, true);
    checks++;
    const publicRoles = new Map([
      [anonymous, "anonymous"],
      [member, "member"],
      [reviewer, "reviewer"],
    ]);
    for (const [client, role] of publicRoles) {
      checkpoint = `public-${role}`;
      const visible = await client
        .from("certificates")
        .select("*")
        .eq("id", publicTarget)
        .single();
      assert.equal(visible.error, null);
      assert.deepEqual(visible.data, before.data);
      checks++;
      for (const operation of ["update", "delete"]) {
        checkpoint = `${operation}-${role}-denial`;
        const table = client.from("certificates");
        const write =
          operation === "update"
            ? table.update({ name: "Unauthorized edit" })
            : table.delete();
        const denied = await write.eq("id", publicTarget).select("*");
        assert.equal(denied.error, null);
        assert.deepEqual(denied.data, []);
        checkpoint = `${operation}-${role}-integrity`;
        const intact = await admin
          .from("certificates")
          .select("*")
          .eq("id", publicTarget)
          .single();
        assert.equal(intact.error, null);
        assert.deepEqual(intact.data, before.data);
        checks++;
      }
    }
    for (const client of [member, reviewer]) {
      checkpoint =
        client === member
          ? "private-schema-denial"
          : "private-schema-reviewer-denial";
      const privateData = await client
        .schema("private")
        .from("app_admins")
        .select("*");
      // This proves the private schema is unexposed, not its table's RLS policy.
      assert.equal(isPrivateSchemaDenied(privateData.error), true);
      checks++;
    }
    const historyArgs = { p_table: "certificates", p_key: target };
    checkpoint = "history-admin";
    const adminHistory = await admin.rpc("admin_list_versions", historyArgs);
    assert.equal(adminHistory.error, null);
    assert.ok(Array.isArray(adminHistory.data));
    checks++;
    checkpoint = "history-member-denial";
    const history = await member.rpc("admin_list_versions", historyArgs);
    assert.equal(isHistoryDenied(history.error), true);
    checks++;
    checkpoint = "history-reviewer";
    const reviewerHistory = await reviewer.rpc(
      "admin_list_versions",
      historyArgs,
    );
    assert.equal(reviewerHistory.error, null);
    assert.ok(Array.isArray(reviewerHistory.data));
    checks++;
    checkpoint = "restore-reviewer-denial";
    // The admin gate runs before the id lookup; prefer a real version when one exists.
    const restoreAttempt = await reviewer.rpc("admin_restore_version", {
      p_version_id: reviewerHistory.data[0]?.id ?? 0,
    });
    assert.equal(isRestoreDenied(restoreAttempt.error), true);
    checks++;
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    checkpoint = "storage-admin";
    const uploaded = await admin.storage
      .from("media")
      .upload(`images/test-item-backend-${fixture.runId}.png`, image, {
        contentType: "image/png",
      });
    assert.equal(uploaded.error, null);
    assert.equal(
      uploaded.data.path,
      `images/test-item-backend-${fixture.runId}.png`,
    );
    checks++;
    checkpoint = "storage-member-denial";
    const deniedUpload = await member.storage
      .from("media")
      .upload(`images/test-item-denied-${fixture.runId}.png`, image, {
        contentType: "image/png",
      });
    assert.equal(isStorageUploadDenied(deniedUpload.error), true);
    checks++;
    checkpoint = "storage-reviewer-list";
    // Only admin_media_select / reviewer_media_select expose media rows, so seeing
    // the admin upload above proves the reviewer SELECT policy, not just a 200.
    const listed = await reviewer.storage.from("media").list("images", {
      search: `test-item-backend-${fixture.runId}`,
    });
    assert.equal(listed.error, null);
    assert.ok(Array.isArray(listed.data));
    assert.ok(
      listed.data.some(
        (object) => object.name === `test-item-backend-${fixture.runId}.png`,
      ),
    );
    checks++;
    checkpoint = "storage-reviewer-denial";
    const reviewerUpload = await reviewer.storage
      .from("media")
      .upload(`images/test-item-reviewer-${fixture.runId}.png`, image, {
        contentType: "image/png",
      });
    assert.equal(isStorageUploadDenied(reviewerUpload.error), true);
    checks++;
    checkpoint = "realtime-admin-auth";
    await admin.realtime.setAuth(sessions.get(admin).access_token);
    let resolveBroadcast;
    const broadcast = new Promise((resolve) => {
      resolveBroadcast = resolve;
    });
    const channel = admin
      .channel("admin:content", { config: { private: true } })
      .on("broadcast", { event: "change" }, (message) => {
        if (
          message.payload?.table === "certificates" &&
          message.payload?.key === target
        )
          resolveBroadcast();
      });
    checkpoint = "realtime-admin-join";
    await subscribe(channel);
    checks++;
    checkpoint = "realtime-anonymous-session";
    const anonymousSession = await anonymous.auth.getSession();
    assert.equal(anonymousSession.error, null);
    assert.equal(anonymousSession.data.session, null);
    for (const client of [anonymous, member]) {
      checkpoint =
        client === anonymous
          ? "realtime-anonymous-join-denial"
          : "realtime-member-join-denial";
      await client.realtime.setAuth(
        client === anonymous ? anonKey : sessions.get(client).access_token,
      );
      const deniedChannel = client
        .channel("admin:content", { config: { private: true } })
        .on("broadcast", { event: "change" }, () => {});
      try {
        await subscribe(deniedChannel, true);
        checks++;
      } finally {
        await client.removeChannel(deniedChannel);
      }
    }
    checkpoint = "realtime-reviewer-join";
    await reviewer.realtime.setAuth(sessions.get(reviewer).access_token);
    const reviewerChannel = reviewer
      .channel("admin:content", { config: { private: true } })
      .on("broadcast", { event: "change" }, () => {});
    try {
      await subscribe(reviewerChannel);
      checks++;
    } finally {
      await reviewer.removeChannel(reviewerChannel);
    }
    checkpoint = "realtime-write";
    const update = await admin
      .from("certificates")
      .update({ name: "test-item backend broadcast" })
      .eq("id", target);
    assert.equal(update.error, null);
    let timer;
    checkpoint = "realtime-delivery";
    try {
      await Promise.race([
        broadcast,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Local realtime broadcast timed out")),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    checks++;
    checkpoint = "fixture-restore";
    const restored = await admin
      .from("certificates")
      .update({ name: "test-item a" })
      .eq("id", target);
    assert.equal(restored.error, null);
    return { status: "PASS", checks, backend: "real-local-supabase" };
  } catch (error) {
    throw backendFailure(checkpoint, checks, error);
  } finally {
    await Promise.allSettled(clients.map((c) => c.removeAllChannels()));
    await Promise.allSettled([
      admin.auth.signOut({ scope: "local" }),
      member.auth.signOut({ scope: "local" }),
      reviewer.auth.signOut({ scope: "local" }),
    ]);
  }
}

/**
 * Run only after the launcher deletes the reviewer's private.app_reviewers row.
 * A fresh sign-in must have lost reviewer access: no access kind, no hidden rows.
 */
export async function verifyReviewerRevoked(fixture, anonKey) {
  const origin = assertLocalSupabase(fixture.apiUrl);
  const { createClient } = await import("@supabase/supabase-js");
  const reviewer = createClient(origin, anonKey, localClientOptions(origin));
  let checks = 0;
  let checkpoint = "revoked-reviewer-auth";
  try {
    const login = await reviewer.auth.signInWithPassword(fixture.reviewer);
    assert.equal(login.error, null);
    assert.ok(login.data.user);
    assert.ok(login.data.session?.access_token);
    checks++;
    checkpoint = "revoked-reviewer-access-kind";
    const access = await reviewer.rpc("admin_access_kind");
    assert.equal(access.error, null);
    assert.equal(access.data, null);
    checks++;
    checkpoint = "revoked-reviewer-hidden";
    const hidden = await reviewer
      .from("certificates")
      .select("id")
      .eq("id", fixture.fixtures.certificateIds[0]);
    assert.equal(hidden.error, null);
    assert.deepEqual(hidden.data, []);
    checks++;
    return { status: "PASS", checks, backend: "real-local-supabase" };
  } catch (error) {
    throw backendFailure(checkpoint, checks, error);
  } finally {
    await Promise.allSettled([reviewer.auth.signOut({ scope: "local" })]);
  }
}
