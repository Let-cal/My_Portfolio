// Fail closed: a failed request is evidence only for the specific boundary probed.
// config.toml exposes public/graphql_public, so private must fail schema selection.
export function isPrivateSchemaDenied(error) {
  return error?.code === "PGRST106";
}

// Migrations 0004/0005 explicitly raise insufficient_privilege for non-admins.
export function isHistoryDenied(error) {
  return error?.code === "42501";
}

// admin_restore_version (0004) checks private.is_admin() before reading the version id,
// so a reviewer gets insufficient_privilege for any id, existing or not. A
// "version % not found" (P0001) or missing-function error would NOT prove the boundary.
export function isRestoreDenied(error) {
  return error?.code === "42501";
}

export function isStorageUploadDenied(error) {
  // storage-js preserves the JSON payload statusCode separately from HTTP status
  // (Storage can send HTTP 400 for a Postgres RLS violation with statusCode 403).
  return (
    (error?.statusCode === "403" || error?.statusCode === 403) &&
    typeof error.message === "string" &&
    /^new row violates row-level security policy(?: for table "objects")?$/i.test(
      error.message,
    )
  );
}

// Once the reviewer can SELECT storage.objects, Storage finds the row and only the
// admin-only UPDATE/DELETE policies stop a write. Depending on the Storage version a
// denied move is either the insert-side RLS violation or "Object not found" from the
// UPDATE that RLS filtered to zero rows. Either way the caller must prove the object
// is unchanged afterwards; this only proves Storage answered with a denial.
export function isStorageMoveDenied(error) {
  return (
    isStorageUploadDenied(error) ||
    ((error?.statusCode === "404" || error?.statusCode === 404) &&
      error.message === "Object not found")
  );
}

// A DELETE filtered by RLS succeeds with an empty list instead of failing, so an
// empty result is the expected denial. Anything listed was really deleted.
export function isStorageRemoveDenied(result) {
  return (
    (result?.error === null &&
      Array.isArray(result.data) &&
      result.data.length === 0) ||
    (result?.data == null && isStorageMoveDenied(result?.error))
  );
}

// With broadcast ack enabled, Realtime replies "ok" only after it relays the message.
// A private-channel send without an INSERT policy on realtime.messages gets no reply
// (or an error reply). Not proof alone: the caller also asserts nobody received it.
export function isBroadcastAckWithheld(result) {
  return result === "timed out" || result === "error";
}

// httpSend resolves { success: true } only for HTTP 202. Realtime accepts a private
// batch and then drops messages the caller may not write, so 202 is an expected
// answer; an explicit authorization rejection is too. Transport failures, timeouts,
// a missing endpoint (404) or JWT problems are not evidence and fail closed.
export function isBroadcastHttpAnswered(outcome) {
  if (outcome?.status === "fulfilled") return outcome.value?.success === true;
  const reason = outcome?.status === "rejected" ? outcome.reason : undefined;
  return (
    reason instanceof Error &&
    reason.name === "Error" &&
    /unauthori[sz]ed|forbidden|permission/i.test(reason.message) &&
    !/jwt|token/i.test(reason.message)
  );
}

export function isRealtimeJoinDenied(status, error) {
  // CLI 2.122.0 pins Realtime 2.147.1: Logging.build_msg prefixes the
  // authorization reason with "Unauthorized: ". realtime-js 2.117.3 preserves
  // that full wire reason in Error.message, not just its inner channel text.
  // Transport errors also use CHANNEL_ERROR; JWT/setup failures are not RLS proof.
  return (
    status === "CHANNEL_ERROR" &&
    error?.message ===
      "Unauthorized: You do not have permissions to read from this Channel topic: admin:content"
  );
}
