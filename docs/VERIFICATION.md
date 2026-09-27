# Verification record

Implementation checked on 26 September 2026. These results describe the local verification performed; the repository’s GitHub Actions badge becomes meaningful only after the branch is pushed and CI runs.

| Check                                        | Result                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Prettier repository formatting               | Passed                                                                        |
| Strict TypeScript checks, client and server  | Passed                                                                        |
| Backend integration, routing and persistence | 23 tests passed                                                               |
| Production frontend and server build         | Passed                                                                        |
| Dependency audit                             | No known vulnerabilities reported by npm audit                                |
| Desktop Chromium and mobile Chromium         | 12 workflow/accessibility tests passed                                        |
| Firefox                                      | Configured in CI; local page creation timed out before the application loaded |
| Automated accessibility                      | No violations in the tested planner view using automated WCAG A/AA rules      |
| WebKit/Safari engine                         | Configured in CI; local execution blocked by missing system libraries         |
| PostgreSQL server integration                | Configured against PostgreSQL 17 in CI; local tests used PGlite               |
| Docker image / HTTPS deployment              | Configuration supplied; not executed in this environment                      |
| Load testing / high availability             | Not performed; no throughput or uptime claim                                  |

## Covered failure cases

- Invalid, impossible or same-stop searches; inactive weekdays; closed service hours.
- Directional routing, downstream departure rounding and minimum transfer time.
- Inaccessible buses or stops, suspended routes and fare accumulation.
- Missing authentication, insufficient roles, CSRF requests and privilege escalation attempts.
- Cross-user access to saved journeys, duplicate saves and expired sessions.
- Login throttling, logout revocation and cookie attributes.
- Conflicting operator edits, invalid foreign keys, transaction rollback and audit recording.
- Data persistence after closing and reopening the local database.
- Browser loading, network failure/retry, empty states, account registration, saved-journey persistence/removal and operator edits.
- Responsive layout, horizontal overflow and automated colour contrast/semantic checks on the planner.

The screenshots in `docs/screenshots/` were captured from the running application. The Chromium checks used a locally available compatible headless Chromium binary because the default browser download was unavailable. Standard CI uses Playwright’s managed browsers.

Automated accessibility checks do not establish complete WCAG conformance. Manual screen-reader testing and real-device testing are still recommended before a public launch. Tests are fixtures with illustrative transit data, not validation of actual operator timetables.
