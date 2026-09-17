# Verification

Tests run without paid services or production credentials.

Verified locally on 2026-09-17: **44 unit tests**, **16 Firebase emulator tests**, and **16 desktop/mobile browser journeys** passed. TypeScript, catalog validation, and the production Pages-subpath build also passed. The browser run uses a production preview; GitHub-hosted workflow execution and a live Firebase campaign still require the organizer's setup.

On Windows, if Playwright's automatically managed preview process hangs during shutdown, run `pnpm preview --port 4173` in a separate terminal with `BASE_PATH=/DnDev/` and then run `pnpm test:e2e`. The tests reuse the existing preview; stop it after testing.

## Suites

| Suite                | Purpose                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | TypeScript contracts and component integration                                                                                                                                     |
| `pnpm test`          | Progression, multiclass arithmetic, source eligibility, content versions, rests, backups, IndexedDB, save timing, retries, in-flight edits, and two-device merge/conflict behavior |
| `pnpm catalog:check` | Unique IDs, publisher/source evidence, source exclusions, dependency integrity, collection classification, and failed-download report                                              |
| `pnpm test:security` | Firebase emulator rules: anonymous access, private invitation boundary, enumeration/admin rejection, disabled campaigns, revisions, malformed core writes, and images              |
| `pnpm test:e2e`      | Desktop and phone-sized Chromium journeys, all six themes, axe accessibility checks, keyboard dialogs, offline reopening, imports, and Pages subpaths                              |

Browser tests use a production build at `/DnDev/`. Run the build and preview/test with the same `BASE_PATH`. The workflow handles this automatically. Browser screenshots and traces are retained for failures, and CI uploads them for review.

The test fixtures are synthetic. Fixed strings used as emulator campaign IDs are test-only; real campaigns must use the cryptographic generator.

The emulator tests exercise real Firestore rules plus the production Firebase adapter: anonymous authentication, two independent IndexedDB draft queues, revision transactions, independent-field merging, and explicit conflict resolution. Additional queue tests use an in-memory remote and deterministic failure/concurrency scenarios. A final smoke test on the organizer's own Firebase project is still required to verify its Console settings, public config, and the two devices actually used at the table.

## Windows Java socket workaround

Use Java 21 or later. Some Windows Java installations fail to start the Firestore emulator with `Unable to establish loopback connection` / `UnixDomainSockets.connect`. This implementation was tested successfully by allowing Java to fall back to TCP sockets:

```powershell
$taskSocketPath = Join-Path (Get-Location) '.cache/no-unix-sockets'
# This directory must remain absent, so the Unix-domain bind falls back to TCP.
if (Test-Path -LiteralPath $taskSocketPath) { throw 'Choose a different absent path' }
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$taskSocketPath -Djava.net.preferIPv4Stack=true"
pnpm test:security
```

This only changes the current shell's test runtime. It changes no firewall settings and does not affect deployment. Linux GitHub-hosted CI uses the ordinary Java configuration.

A project-scoped Playwright browser cache can be used in restricted environments:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/browsers'
pnpm exec playwright install chromium
```

## Acceptance boundaries

A passing browser suite checks the implemented journeys; it is not a claim that every sourcebook effect is automatically adjudicated. See [automation coverage](content-catalog.md). Mobile tests use a Chromium phone viewport and touch emulation; the organizer should also smoke-test their actual iOS/Safari or Android browser.

Remote delivery when the OS terminates a page is inherently best effort. Tests verify durable drafts, retry, offline reopening, and conflict handling. They do not claim that a browser can guarantee an asynchronous write after termination.

Schema 1 is the first persisted schema. Optional-field defaults preserve older schema 1 documents and backups. Future schema versions are rejected safely until a corresponding migration is implemented and tested.
