# Release validation report

Status: incomplete. Automated local evidence is recorded below; this is not a release approval because the participant study and full WebKit UI run are outstanding.

## Required gate evidence

| Gate | Command or evidence | Result |
|---|---|---|
| Formatting | `pnpm format` | passed locally 2026-09-04 |
| Lint | `pnpm lint` | passed locally 2026-09-04 |
| Types | `pnpm typecheck` | passed locally 2026-09-04 |
| Contracts | `pnpm contract:check` | passed locally 2026-09-04 |
| Unit/property/integration/concurrency | `pnpm test:unit`, `test:property`, `test:integration`, `test:concurrency` | 44 unit, 1 property, 18 integration, 1 contention test passed locally |
| Chromium/Firefox/WebKit E2E | `pnpm test:e2e` | Chromium 12/12 and Firefox 12/12 passed with PostgreSQL; WebKit UI unavailable because host libraries are missing |
| Performance profile | `pnpm test:performance` | 100/100 updates within 2 s; p95 21.0–23.2 ms; 20/20 owner reads within 5 s |
| WebMCP/security | `pnpm test:webmcp`, `pnpm test:security` | 7 WebMCP and 7 security tests passed locally |
| Participant study | `usability-report.md` | unrecorded |

## Requirements matrix

Record each FR-001–FR-035, SC-001–SC-012, and Constitution Principles I–V with a direct test, command output, or study-row reference. A pass requires direct evidence; a skipped test or template row is not evidence.

| Group | Evidence reference | Result |
|---|---|---|
| FR-001–FR-035 | _unrecorded_ | _unrecorded_ |
| SC-001–SC-012 | _unrecorded_ | _unrecorded_ |
| Principle I: Human authority | _unrecorded_ | _unrecorded_ |
| Principle II: Deterministic commerce | _unrecorded_ | _unrecorded_ |
| Principle III: Shared attributable state | _unrecorded_ | _unrecorded_ |
| Principle IV: Least privilege | _unrecorded_ | _unrecorded_ |
| Principle V: Auditable reliability | _unrecorded_ | _unrecorded_ |

## Release decision

No release decision is recorded. Complete the participant study, run the full gate in a WebKit-capable environment, attach the command outputs, and fill the matrix before approving release.

## Hackathon submission position

The repository is suitable for a **prototype/hackathon demonstration** based on the automated evidence above. The submission must disclose that buyer and owner cohort evidence is synthetic and that WebKit UI validation was not available on the local Linux host. It must not claim a production release or a completed human usability study.
