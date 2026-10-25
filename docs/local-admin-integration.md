# Disposable admin integration

Status: **Merged in PR #18; the job runs on every pull request.** The first Linux trial failed before the admin browser cases; that run and its investigation are kept in [actual Linux evidence and investigation](admin-integration-linux-trial-2026-10-24.md), and later runs pass. Since then it also covers the read-only reviewer (PR #20). The sections below are the design record written for that PR, kept as written.

This separately reviewable branch extends the Task 4 validation foundation with an owned ephemeral runner, synthetic provisioning, backend checks, six actual browser scenarios and one scoped job in the existing CI workflow. The source application, deployed migrations, Auth/RLS, public UI and current required checks are unchanged. Docker is unavailable on this workstation. The first Linux run verified stack setup, migration replay and provisioning, then failed during backend probes; real Auth/CRUD/Storage/Realtime and browser acceptance are still incomplete. Pure tests and static review do not substitute for that evidence.

## Delivery boundary

The candidate is based on released main `a584138`, independently of the open media-library PR #15. Existing upload permissions are covered by a real local backend probe. Library browsing, picker/reference and deletion-protection flows are not present on this main revision and require #15's separate integration and corresponding tests. They are not silently skipped or counted as covered here. Read-only hosted reviewer access is Task 5, a separate security increment.

## Owned lifecycle

1. The job launches Node through `env -i` with only public run identifiers and essential executable paths. The launcher refuses extra inherited settings, non-Linux platforms and non-GitHub-hosted workers.
2. Create a private temporary source copy and HOME. Verify checkout HEAD matches the reported SHA and tracked files are clean. Copy only regular tracked files; reject environment files and symlinks. Dependencies are linked from this run's locked installation. No original checkout, developer server or environment is reused.
3. Pin the official Supabase CLI **2.122.0**. Create a random project namespace, confirm Docker has no matching container/volume/network resources, and assert reserved ports are unused before starting services. Create a uniquely labelled bridge with a loopback publishing default and pass that network explicitly to the CLI; never change Docker daemon settings. CLI workdir is explicit; no project link, hosted database, remote reset or management credential is used.
4. After start, verify Docker IDs, project labels, running state and DB/API port bindings. Every published service port must bind exactly to `127.0.0.1`; wildcard, IPv6 or other interface bindings fail before provisioning. The bridge ID, name, driver, ownership label and loopback default must also match. Validate CLI status against loopback endpoints and verify local anonymous/service JWT signatures using this stack's local signing secret. Compare the replayed migration history with all committed migration versions on the empty database.
5. Provision only `task4-*@example.invalid` synthetic identities and content. The local service-role key is confined to fixture provisioning; only anonymous API configuration reaches Next.js. Browser processes receive the private fixture path, not a service-role key or hosted credential.
6. Run direct real Auth/RLS/Storage/private Realtime probes, build a dedicated production-mode app and start its owned process on `127.0.0.1:4327`. Run only the six admin scenarios, with one worker, zero retries and no skipped/flaky PASS.
7. Terminate the owned app process group and stop only this namespace with `--project-id` and `--no-backup`. Remove only the created bridge after verifying its identity, unless the project stop already removed it. Ownership mismatch or teardown failure fails the job. Cancellation receives best-effort scoped cleanup; the dedicated hosted VM is ultimately discarded.

Loopback and project markers alone are not ownership proofs. The empty pre-start inventory, freshly generated namespace, explicit CLI launch and post-start Docker inspection are required together. These are trusted-runner consistency checks, not protection against malicious repository code that already controls that disposable runner.

## Coverage

| Layer | Required candidate checks |
| --- | --- |
| Real backend | Admin/member login; hidden-read denial plus positive published-row reads before denied writes and full-row integrity checks; authorization-specific private schema/history/Storage denials with admin success controls; anonymous/member private Realtime rejection plus admin delivery |
| Browser 1 | Login/logout and anonymous/member denial |
| Browser 2 | Certificate CRUD, published visibility and persisted keyboard ordering |
| Browser 3 | Draft preservation across reload and clearing after save |
| Browser 4 | Two-tab real Realtime updates, conflicts and deletion elsewhere |
| Browser 5 | Cross-tab signout, retained form and actual reauthentication |
| Browser 6 | Recovery after browser-simulated offline networking |

Offline networking is a deliberate browser simulation. Auth, server actions, RLS, Postgres, Storage and Realtime are actual local services; no Supabase response mocking or route interception substitutes for them.

## CI runtime and privacy

`Disposable admin Auth, CRUD and RLS` runs in parallel with the existing jobs on a standard `ubuntu-24.04` runner. It does not rerun the 64 public tests or change their runtime image, thresholds or aggregate. A native worker is needed for local Docker services. The admin-only browser uses the runner's preinstalled Chrome instead of another apt/browser download; its version is recorded, and a missing channel fails rather than falling back. This follows the runner image's Chrome version, not the public suite's pinned Chromium revision.

The additional job fills missing signed-in backend coverage and increases runner occupancy. First-run image pulls/build/service startup can become the critical path; no wall-time improvement or fixed duration is claimed before Linux measurements. Phase durations are recorded in the sanitized summary. No larger runner or paid Supabase branch/project is created. This candidate does not change branch protection; the agent must require its scoped integration result before proposing merge once activated.

Only `reports/admin-integration-summary.json` is uploaded, with three-day retention. It contains fixed status, phase/timings, revision/run/attempt, browser version and selected counts and the six fixed scenario IDs. Raw CLI output, signed-in DOM, Auth responses, fixture passwords, server logs and traces stay private on the ephemeral worker and are never artifacts. Browser screenshots/video/traces/storage-state output are disabled; extra failure context is suppressed. The reporter binds discovered and completed tests to the exact six titles, source file and project. It rejects replacements, duplicates, omissions, retries and inconsistent revision/count evidence; the artifact projection validates scenario identities independently.

## Implemented contract

- `assertLocalSupabase(url)` accepts only explicit HTTP loopback API origins using `127.0.0.1`, `localhost` or `[::1]` and a non-default port. It rejects hosted URLs, URL normalization tricks, userinfo, unexpected paths, query strings and fragments before parsing.
- `assertLocalDatabaseUrl(url)` restricts the DSN to an explicit loopback port and the disposable CLI default `postgres:postgres` / `postgres` identity. A different local identity requires a reviewed extension. This syntax check does not prove which database is listening.
- `buildLocalSupabaseEnv({ status, provenance, inheritedEnv })` takes explicit inputs, rejects inherited backend/auth/secrets/proxy settings, and creates a fresh app-only allowlist. It does not copy `process.env` or return a database/service-role credential. Status is a projection containing only `API_URL`, `DB_URL`, `ANON_KEY`; the owned launcher privately reads CLI output and explicitly project these fields.
- The caller's project/run marker and endpoint agreement are consistency checks only. A marker is forgeable and cannot authorize a seed/reset. The local anonymous key check is restricted to the documented legacy local shape with `supabase-demo` issuer; it checks claims/encoding, not signature or actual service identity. New CLI key formats must be deliberately supported and verified, not accepted by disabling the guard.
- Validation errors omit the rejected URLs, DSNs and keys. Test credentials and tokens are synthetic and have no relationship to hosted accounts.

## Verification

```powershell
node --test tests/scripts/local-supabase.test.mjs
```

Additional local verification:

```powershell
node --test tests/scripts/disposable-runtime.test.mjs tests/scripts/disposable-launcher.test.mjs tests/scripts/local-seed.test.mjs tests/scripts/admin-reporter.test.mjs
npx --no-install vitest run tests/unit/admin-integration-settings.test.ts
npm run verify
npm audit
```

The standalone launcher deliberately returns nonzero `BLOCKED` outside its owned clean Linux CI environment. The full integration run requires the workflow's explicit clean environment, Docker and Chrome. Do not pass hosted variables or invoke the production seed script to make it run.

During preparation, two existing transitive advisories were reported in `undici` and `fast-uri`. Their lockfile entries were updated within the existing dependency ranges to 8.12.3 and 3.1.9, respectively; no force upgrade or framework change. A fresh full audit returned zero findings at that verification point.

## Remaining acceptance gates

1. Complete local verification and independent code review, then obtain explicit approval of this concrete CI/CD candidate before pushing or running it on GitHub.
2. Verify the real Linux service lifecycle, empty-database migration replay and every backend/browser case. Measure setup/build/browser/cleanup timings and investigate any failure before merge. Missing Docker or a skipped mandatory case is not PASS.
3. Integrate #15 only under its own approval and add media-library-specific coverage. Prepare reviewer authorization separately; no hosted account, policy rollout or shared-database probe is authorized by this candidate.

The owner must approve concrete CI/CD and Auth/RLS results before integration/application. Hosted preview content stays read-only. No hosted write-denial probes are authorized by this document.

## Official references

- [Supabase local workflow and explicit local/linked targets](https://supabase.com/docs/guides/local-development/cli-workflows)
- [CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [CLI 2.122.0 release](https://github.com/supabase/cli/releases/tag/v2.122.0)
- [Docker bridge publishing defaults](https://docs.docker.com/engine/network/drivers/bridge/)
- [Ubuntu 24.04 hosted runner software](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
