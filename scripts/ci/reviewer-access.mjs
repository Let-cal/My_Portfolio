// Fixed SQL for the launcher's `docker exec … psql -Atc` grant/revoke of the synthetic
// reviewer. No interpolation: the email is a constant, never caller input.
export const reviewerEmail = "task4-reviewer@example.invalid";

// Each statement prints only the number of rows it changed (psql -At: bare "1").
export const reviewerGrantSql =
  "with granted as (insert into private.app_reviewers(user_id) " +
  `select id from auth.users where email = '${reviewerEmail}' returning 1) ` +
  "select count(*) from granted";

export const reviewerRevokeSql =
  "with revoked as (delete from private.app_reviewers r using auth.users u " +
  `where r.user_id = u.id and u.email = '${reviewerEmail}' returning 1) ` +
  "select count(*) from revoked";

/** Fail closed unless psql reported exactly one changed row. Never echoes the output. */
export function assertSingleRowChange(stdout) {
  if (typeof stdout !== "string" || stdout.trim() !== "1")
    throw new Error("Reviewer access change did not affect exactly one row");
}
