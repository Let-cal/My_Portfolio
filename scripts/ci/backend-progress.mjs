// Only these fixed, credential-free labels may leave the private integration process.
export const backendCheckpoints = Object.freeze([
  "bootstrap",
  "auth-admin",
  "auth-member",
  "auth-reviewer",
  "access-kind",
  "hidden-admin",
  "hidden-anonymous",
  "hidden-member",
  "hidden-reviewer",
  "insert-member-denial",
  "insert-reviewer-denial",
  "public-admin",
  ...["anonymous", "member", "reviewer"].flatMap((role) => [
    `public-${role}`,
    ...["update", "delete"].flatMap((operation) => [
      `${operation}-${role}-denial`,
      `${operation}-${role}-integrity`,
    ]),
  ]),
  "private-schema-denial",
  "private-schema-reviewer-denial",
  "history-admin",
  "history-member-denial",
  "history-reviewer",
  "restore-reviewer-denial",
  "storage-admin",
  "storage-member-denial",
  "storage-reviewer-list",
  "storage-reviewer-denial",
  "storage-reviewer-remove-denial",
  "storage-reviewer-remove-integrity",
  "storage-reviewer-move-denial",
  "storage-reviewer-move-integrity",
  "realtime-admin-auth",
  "realtime-admin-join",
  "realtime-anonymous-session",
  "realtime-anonymous-join-denial",
  "realtime-member-join-denial",
  "realtime-reviewer-join",
  "realtime-reviewer-send-denial",
  "realtime-reviewer-http-send-denial",
  "realtime-reviewer-send-silence",
  "realtime-write",
  "realtime-delivery",
  "fixture-restore",
  // verifyReviewerRevoked, after the launcher deletes the private.app_reviewers row.
  "revoked-reviewer-auth",
  "revoked-reviewer-access-kind",
  "revoked-reviewer-hidden",
]);
const categories = new Set(["assertion-failed", "request-failed"]);

export function backendFailure(checkpoint, completedChecks, original) {
  const error = new Error("Disposable backend integration failed");
  error.code = "TASK4_BACKEND_FAILURE";
  error.checkpoint = checkpoint;
  error.completedChecks = completedChecks;
  error.category =
    original?.code === "ERR_ASSERTION" ? "assertion-failed" : "request-failed";
  // Deliberately no original message, stack, response, cause or assertion values.
  return error;
}

export function projectBackendFailure(error) {
  if (
    error?.code !== "TASK4_BACKEND_FAILURE" ||
    !backendCheckpoints.includes(error.checkpoint) ||
    !Number.isSafeInteger(error.completedChecks) ||
    error.completedChecks < 0 ||
    error.completedChecks > 100 ||
    !categories.has(error.category)
  )
    return undefined;
  return {
    checkpoint: error.checkpoint,
    completedChecks: error.completedChecks,
    category: error.category,
  };
}
