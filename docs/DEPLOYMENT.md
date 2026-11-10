# Milestone 5: production deployment

The user has confirmed Vercel is already connected to GitHub. The repository remote is `SarahAHuynh/Outfyt`. Local release preparation is separate from actually deploying or passing production acceptance. No deployment, Git commit/push, production credential change or hosted migration has been performed by the assistant.

Follow one stage at a time. If a label differs, use the equivalent setting rather than guessing a value. Never share credentials, email-confirmation URLs or tokens in chat.

## Stage 1: review and push the release

In PowerShell at `C:\Users\sarahhuynh\Outfyt`:

```powershell
git status
git diff --stat
git check-ignore .env.local
npm run check:config
```

Expected: `.env.local` is ignored, and required local configuration checks pass without printing values. This does not test live credentials. Review the changed files and ensure no private photos, secrets or unrelated changes are included. Then, when ready:

```powershell
git add .
git commit -m "Prepare Outfyt for deployment"
git push
```

The assistant has not run these mutation commands for you. Open https://github.com/SarahAHuynh/Outfyt and verify the commit is present. Under **Actions**, Application checks will run after the workflow is pushed. It installs from the lockfile, runs lint/tests/build/types, uses no production secrets and never deploys. Its first real GitHub run is not yet verified.

## Stage 2: import into Vercel

1. Open https://vercel.com/dashboard and select your personal account/workspace.
2. Select **Add New → Project** (or **New Project**).
3. In **Import Git Repository**, find `SarahAHuynh/Outfyt` and click **Import**. If absent, open the GitHub integration's repository permissions and grant access to this repository only, then refresh the list.
4. Name the project **outfyt**, or choose another available name. Keep the repository's root directory (`./`).
5. Confirm **Framework Preset: Next.js**. Leave its output directory at the framework default. Use `npm run build` as the build command and `npm ci` as the install command when custom fields are shown.
6. The repository pins **Node.js 22.x** in `package.json` so Vercel uses the tested major version instead of a newer default. Verify 22.x under project **Settings → Build and Deployment** when the project exists. Newer versions are not claimed tested here.
7. Stop at the import configuration screen if following the interactive setup with the assistant. Next is adding production environment values locally in Vercel, not pasting them in chat.

## Stage 3: production environment variables and first build

Expand **Environment Variables** on the import screen, or open project **Settings → Environment Variables**. Add variables individually from your local private configuration. Enable **Production**; keep Preview disconnected from real user data unless you deliberately configure a separate test project. Do not copy `.env.local` into GitHub.

| Variable | Value and where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing project URL from Supabase project settings/API connection details |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing publishable key, or legacy anon key; never service-role/secret key |
| `OPENAI_API_KEY` | Existing project-specific server API key from your private configuration; set Sensitive when the UI supports it |
| `OPENAI_MODEL` | The model you have already tested locally (example `.env.example`: `gpt-5.4-mini`) |
| `UNSPLASH_ACCESS_KEY` | Existing server-side Unsplash Access Key; optional, but photo recommendations require it |
| `NEXT_PUBLIC_APP_URL` | Exact HTTPS production origin with no path/query; configure once the assigned domain is known |

`NEXT_PUBLIC_` values enter client bundles and are public. OpenAI and Unsplash keys must retain their server-only names. Pinterest credentials are not needed; board bookmarks work without OAuth. No Supabase privileged credential is required. The prebuild guard rejects a supplied privileged browser key before compiling it into a bundle.

For the very first deployment, if Vercel has not shown the final domain yet, leave `NEXT_PUBLIC_APP_URL` unset rather than entering a guessed URL or localhost. The build can complete, but signup/resend intentionally refuse to create production confirmation links until the real origin is set. Existing-account sign-in does not need that variable. Complete the next stage before testing signup or sharing the app.

Review the configuration and select **Deploy** when you want to publish. Watch the build logs. Expected: prebuild public-key guard passes, Next.js compiles, and the deployment becomes **Ready**. Open **Visit** and copy only the website origin, such as `https://YOUR-ASSIGNED-DOMAIN.vercel.app`. The exact domain may differ from the project name.

## Stage 4: exact app origin and Supabase redirects

1. In Vercel project **Settings → Environment Variables**, add/update `NEXT_PUBLIC_APP_URL` to the exact assigned HTTPS origin. Example: `https://YOUR-ASSIGNED-DOMAIN.vercel.app` (replace the placeholder). No `/dashboard`, callback path, query string or localhost.
2. Open https://supabase.com/dashboard, select the existing Outfyt project, and open **Authentication → URL Configuration**.
3. Set **Site URL** to that same production origin.
4. Under **Redirect URLs**, add these exact values, replacing the origin:

```text
https://YOUR-ASSIGNED-DOMAIN.vercel.app/auth/callback
https://YOUR-ASSIGNED-DOMAIN.vercel.app/auth/confirm
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
```

5. Keep the localhost entries if continuing local development. Avoid broad wildcard access to arbitrary preview domains for the production database. Configure only deliberate, trusted preview URLs; a separate Supabase test project is preferable for previews.
6. Save the URL configuration. Do not disable email confirmation or weaken row policies to get a test passing.
7. In Vercel **Deployments**, choose the latest production deployment's menu and **Redeploy**. Environment changes affect a new deployment, not the already-built one. Expected: Ready again with the exact production origin baked into the app.
8. Open a new private browser window at the production URL. Test signup/confirmation only now. Use a fresh email link; do not reuse an expired link generated for localhost.

The default Supabase email sender has restrictions and low quotas; the earlier resend issue is separate from hosting. If email delivery or template changes require custom SMTP, handle that as a separate setup stage with the user's provider. Do not claim SMTP is configured or promise a countdown when the provider omits a reset time.

## Stage 5: database, storage and runtime readiness

No new migration is required for the Milestone 5 repository changes. The app expects migrations 0001 through 0006 already applied, in order. Do not rerun them just because you deployed.

In Supabase **SQL Editor**, run `supabase/checks/release.sql`. It is read-only and checks all 19 application tables have row security, required checked functions exist, sensitive direct writes remain revoked, and both image buckets are private. Expected: PASS. If a function/table is missing, identify the unapplied migration instead of bypassing access controls. Other rollback-only ownership checks are in `supabase/checks/`.

Vercel-specific details verified against official documentation on November 10, 2026:

- Function bodies are capped at 4.5 MB. New app uploads are limited to **4 MB** plus bounded multipart metadata, in both wardrobe and inspiration. Existing stored images up to the former 10 MB limit are retained; direct signed previews still work, and inspiration analysis accepts them subject to a 20 MB combined binary input cap. The Storage bucket's original 10 MB ceiling can remain; it is an upper bound, not the app's new-upload allowance.
- Node routes declare 90 seconds for clothing analysis, 120 for inspiration analysis, and 180 for the stylist. Verify Fluid compute is enabled and the selected plan permits those durations. Current Hobby Fluid compute documentation allows up to 300 seconds; account/project settings and quotas still need actual verification. Do not buy a plan solely on assumption or promise all AI operations complete before the timeout.
- Stylist responses stream real stages. The loop checks a 150-second deadline between steps; it is not an absolute cancellation guarantee for an already-running external request. An interruption may leave a running turn for up to five minutes. Check action history before repeating a mutation.
- Environment variables must be set separately per deployment environment. Local `.env.local` is not uploaded from Git. Production account/AI quotas still apply to failed requests.

## Production acceptance tests

| Test | Expected result |
| --- | --- |
| Open landing and login in a private window | Public pages render over HTTPS |
| Open /closet or /settings while signed out | Redirect to login; no other user's data |
| Signup with a permitted email, confirm, sign in | Returns to the production dashboard, never localhost |
| Refresh while signed in, then sign out | Session persists appropriately; protected pages reject signed-out access |
| Change Settings display name and refresh | Confirmed name persists; email stays read-only |
| Upload a real JPEG/PNG/WebP below 4 MB | Private photo displays and persists |
| Try a new image above 4 MB | Helpful rejection before upload; no misleading success |
| View existing older photos | Existing signed photos still load |
| Analyze clothing, edit recognition, save | Real analysis and database persistence |
| Finish Style DNA with inspiration skipped | One-panel flow, saved summary and approval behavior work |
| Analyze permitted inspiration and approve edited suggestions | Real suggestions, preserved manual choices, persisted final review |
| Generate/save/modify a look and refresh the lookbook | Actual owned clothes, live stages, saved state and persistence |
| Save a look, open dashboard | A real recent-look card appears |
| Request image examples for missing clothes | Credited stock-reference cards, separate from owned clothes |
| Reject a deletion, then confirm a separate test deletion | Rejection keeps the record; confirmation alone executes it |
| Sign in as a second test user | No first-user clothes, history, preferences, logs or bookmarks |
| At mobile width, open menu, Tab, Escape, reopen/navigate | Focus stays in the menu; Escape closes and restores focus; route selection closes it |
| Resize an open mobile menu to desktop | Menu closes cleanly; desktop scrolling/navigation works |
| Visit an unknown URL | Styled 404 with working return link |
| Check Vercel runtime logs | Requests finish without unhandled errors; do not share raw logs containing URLs/tokens |

Optional non-mutating HTTP checks against an accessible deployment:

```powershell
node tests/auth-smoke.mjs https://YOUR-ASSIGNED-DOMAIN.vercel.app
node tests/wardrobe-smoke.mjs https://YOUR-ASSIGNED-DOMAIN.vercel.app
node tests/stylist-smoke.mjs https://YOUR-ASSIGNED-DOMAIN.vercel.app
node tests/release-smoke.mjs https://YOUR-ASSIGNED-DOMAIN.vercel.app
```

Deployment Protection can intercept remote smoke requests before the app; if so, use the permitted browser session or explicitly configured access, not a bypass. These checks exercise signed-out behavior only and do not replace the signed-in manual tests.

## Troubleshooting and redeployment

| Symptom | Action |
| --- | --- |
| Confirmation opens localhost/wrong site | Fix exact APP_URL + Supabase Site URL/redirects, redeploy, request a fresh link |
| Public-key prebuild guard fails | Replace the browser variable with publishable/anon key; never expose a privileged key |
| Missing key/model error | Check Production environment scope and model access; redeploy after edits |
| AI request times out | Inspect Functions/Fluid compute settings and logs, then check action history before retrying |
| 413 during upload | Choose a photo below 4 MB; don't raise the form limit past the hosting cap |
| Missing SQL function/table | Apply only the missing migration(s) in order and rerun read-only release check |
| Styling/photo search is quota-limited | Wait for the actual allowance; preserve manual entry and report honest errors |
| Images don't load | Confirm the correct private bucket and owner paths; refresh signed links; never make the bucket public |
| Profile changed conflict | Refresh Settings before editing again |
| Repo not listed in Vercel | Adjust GitHub App permissions for Outfyt and refresh import list |

Future code changes: review and commit locally, push to GitHub, let CI and Vercel build, verify the resulting production deployment, and rerun affected acceptance checks. For a bad release, use Vercel's deployment controls to promote/redeploy the last known good version; this does not reverse database/data changes. Never run destructive SQL to compensate for a frontend rollback.

Milestone 5 is complete only after the real deployment URL, production auth/Storage/AI flows, and final user acceptance are verified. This guide itself does not establish completion.

Official references:
- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://supabase.com/docs/guides/auth/redirect-urls
