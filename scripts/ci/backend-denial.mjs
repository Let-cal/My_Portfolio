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
