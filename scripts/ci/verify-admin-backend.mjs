import assert from "node:assert/strict";
import { assertLocalSupabase } from "./local-supabase.mjs";
import { backendFailure } from "./backend-progress.mjs";
import {
  isHistoryDenied,
  isPrivateSchemaDenied,
  isRealtimeJoinDenied,
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

/** Real local Auth/RLS/Storage/Realtime checks. No service-role client or mock transport. */
export async function verifyAdminBackend(fixture, anonKey) {
  const origin = assertLocalSupabase(fixture.apiUrl);
  const { createClient } = await import("@supabase/supabase-js");
  const options = {
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
  const admin = createClient(origin, anonKey, options),
    member = createClient(origin, anonKey, options),
    anonymous = createClient(origin, anonKey, options);
  const clients = [admin, member, anonymous];
  const sessions = new Map();
  let checks = 0;
  let checkpoint = "bootstrap";
  try {
    for (const [client, identity] of [
      [admin, fixture.admin],
      [member, fixture.member],
    ]) {
      checkpoint = client === admin ? "auth-admin" : "auth-member";
      const login = await client.auth.signInWithPassword(identity);
      assert.equal(login.error, null);
      assert.ok(login.data.user);
      assert.ok(login.data.session?.access_token);
      sessions.set(client, login.data.session);
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
    checkpoint = "insert-member-denial";
    const inserted = await member.from("certificates").insert({
      id: "test-item-denied",
      name: "Denied",
      organization: "Synthetic issuer",
      issue_date: "2026-01-01",
      topic: "engineering",
      description: { en: "Denied" },
    });
    assert.equal(inserted.error?.code, "42501");
    checks++;
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
    for (const client of [anonymous, member]) {
      const role = client === anonymous ? "anonymous" : "member";
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
    checkpoint = "private-schema-denial";
    const privateData = await member
      .schema("private")
      .from("app_admins")
      .select("*");
    // This proves the private schema is unexposed, not its table's RLS policy.
    assert.equal(isPrivateSchemaDenied(privateData.error), true);
    checks++;
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
    ]);
  }
}
