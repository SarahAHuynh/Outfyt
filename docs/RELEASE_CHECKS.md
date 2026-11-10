# Local release review

This records the Milestone 5 review scope; it is not a security certification or a production test result.

## Repository changes

- Dashboard reads actual recent looks and uses current styling copy; errors are distinct from empty data.
- Settings reads the authenticated profile and saves only the owner's display name using an expected timestamp. Email is read-only. The former inert Pinterest button now links to the working inspiration feature.
- Native modal mobile navigation supports Tab focus containment, Escape, focus return, backdrop close, body scroll restoration and resize cleanup. Skip-to-content and visible keyboard outlines are present. Desktop navigation stays usable independently.
- Global page errors and 404s provide recovery links without displaying raw exception details or claiming an interrupted mutation was rolled back.
- New image uploads are capped at 4 MB to fit Vercel; stored legacy images remain readable. Combined inspiration analysis is capped at 20 MB of image bytes.
- Production signup/resend require an explicit public HTTPS app origin on Vercel, avoiding accidental localhost confirmation links.
- Responses use anti-sniffing/frame headers. API/auth responses and protected redirects are no-store. Auth callbacks suppress referrers. This does not implement a full Content Security Policy.
- The prebuild guard rejects a provided privileged Supabase browser key. Configuration diagnostics print names/status, not values, and do not make network requests.
- GitHub Actions runs lint, mocked-service tests, build and type checking on pushes/PRs after the user pushes the workflow. It has read-only repository permissions and no production secrets or deployment action.

## Verification commands

```powershell
npm run check:config
npm run lint
npm test
npm run build
npm run typecheck
npm audit --omit=dev
```

Use `npm ci` when preparing a clean checkout. Build precedes the standalone type check on a clean runner so Next's generated route types exist. Build runs its own TypeScript validation too. A Windows sandbox `spawn EPERM` needs the permitted worker execution rerun, not an application code workaround.

Run the four smoke scripts in `tests/` against a started local production server. New regression tests cover public production callback origins, rejected owner/email fields, profile timestamps/row ownership, new-upload versus legacy-image limits, release SQL configuration, response headers and profile route protection. No paid AI calls are needed for these checks.

`supabase/checks/release.sql` is read-only. The profile and other ownership checks use isolated fixtures inside transactions that roll back. The PGlite harness runs all six migrations and these checks using a minimal mocked Auth/Storage schema; it does not replace hosted verification.

## Remaining external verification

Local results on November 10: all 69 automated tests, lint, TypeScript, production build, configuration diagnostics and all four signed-out HTTP smoke scripts passed. The production npm dependency audit reported no known vulnerabilities. GitHub Actions run status has not been inspected.

Later on November 10, all four HTTP smoke scripts also passed against the live site https://outfyt-dun.vercel.app/. Its updated homepage returned HTTP 200 with one Start styling action and three clothing photos. Public deployment is verified. The user must still verify production environment settings, hosted migrations/Storage, exact email redirect behavior, runtime settings, live paid AI behavior, signed-in privacy, mobile keyboard interaction and the class demo. Pinterest remains optional reference-only; review Unsplash's production requirements before a broader public release.

Use `docs/DEPLOYMENT.md` for the staged external setup and acceptance checklist. Keep `codex.md` updated with actual results and the exact next user action.
