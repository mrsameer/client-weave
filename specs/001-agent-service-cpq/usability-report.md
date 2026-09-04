# Pre-release usability study

Status: awaiting participant sessions. Do not treat this template as study evidence.

## Protocol

- Recruit 10 first-time buyers and 5 first-time owner-role participants who have not read the implementation artifacts.
- Assign every participant a fresh seeded workspace/scope and record only a randomized participant ID.
- Run the buyer task from a natural-language goal through a complete priced scope and confirmed consultation. Record completion time, assistance, and whether the participant correctly identifies human versus agent provenance.
- Run the owner task from the configured template through intake fields, pricing rules, constraints, publication, and initial availability. Record completion time and assistance.
- Run the 20 version-controlled agent journeys in `tests/fixtures/agent-journeys.json` using the same release candidate. Record terminal state, unintended side effects, and timing environment.
- Capture browser, operating system, network condition, database revision, release commit, test date, and all failures. Do not record names, emails, transcript content, or scope text.

## Pass criteria

| Measure | Required pass count |
|---|---:|
| Buyer completion under 3 minutes (SC-001) | at least 9 of 10 |
| Buyer unassisted completion (SC-002) | at least 9 of 10 |
| Buyer provenance identification (SC-008) | at least 9 of 10 |
| Owner configuration under 15 minutes (SC-009) | 5 of 5 |
| Fixed agent journeys correct (SC-004) | at least 19 of 20 |
| No unintended action (SC-005) | 20 of 20 |

## Session records

### Environment

| Field | Value |
|---|---|
| Release commit | _unrecorded_ |
| Database migration revision | _unrecorded_ |
| Date range | _unrecorded_ |
| Browser/OS | _unrecorded_ |
| Network profile | _unrecorded_ |

### Buyers (P01–P10)

| ID | Completed | Under 3 min | Unassisted | Provenance correct | Notes/failure code |
|---|---|---|---|---|---|
| P01–P10 | _unrecorded_ | _unrecorded_ | _unrecorded_ | _unrecorded_ | _unrecorded_ |

### Owners (O01–O05)

| ID | Completed | Under 15 min | Unassisted | Notes/failure code |
|---|---|---|---|---|
| O01–O05 | _unrecorded_ | _unrecorded_ | _unrecorded_ | _unrecorded_ |

### Agent journeys (A01–A20)

| ID | Terminal state correct | Unintended action | Environment | Notes/failure code |
|---|---|---|---|---|
| A01–A20 | _unrecorded_ | _unrecorded_ | _unrecorded_ | _unrecorded_ |

## Outcome summary

No sessions have been recorded. T120 remains incomplete until the rows above contain the raw anonymized outcomes and calculated exact pass counts.

## Hackathon simulation appendix

The following is automated synthetic evidence for a hackathon submission. It is not a substitute for the participant study above and must not be presented as first-time-human research.

| Synthetic cohort | Method | Result |
|---|---|---|
| Buyer flow | Chromium ordinary-interface journey, discovery through owner handoff | 1/1 completed in 10.0 seconds |
| Owner flow | Database-backed owner configuration and lead-review flows | 3/3 Chromium checks passed; 3/3 Firefox checks passed |
| Agent corpus | Version-controlled WebMCP fixture plus adapter journey checks | 20 scenarios present; 7 automated WebMCP checks passed |
| Performance | PostgreSQL authoritative-read and owner-read cohort | 100/100 updates under 2 seconds; 20/20 finalizations owner-visible under 5 seconds |

Simulation environment: Ubuntu Linux, Node 22.20.0, PostgreSQL 16 on localhost, Chromium and Firefox Playwright projects. WebKit UI was not simulated because this host lacks `libgstreamer-plugins-bad1.0-0`, `libflite1`, `libavif16`, and `gstreamer1.0-libav`.
