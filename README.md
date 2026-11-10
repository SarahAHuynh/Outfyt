# Outfyt

**your closet. your aesthetic. your way.**

Outfyt is a digital wardrobe and personal AI stylist built for CS4680 Prompt Engineering. It solves the gap between generic outfit advice and the clothes a person actually owns: users upload garments, define their taste, ask for looks in natural language, and let a real agent save or modify the resulting combinations.

## Features and status

| Area | Implemented behavior |
| --- | --- |
| Accounts | Email/password signup, confirmation, login/logout, protected sessions, editable display name |
| Wardrobe | Private photos, real AI recognition, editable attributes, manual entry, filters, edits and confirmed deletion |
| AI Stylist | Real multi-step function calling, owned-item validation, persistent separate chats, progress, approvals and action history |
| Lookbook | Save, favorite, rename, edit combinations, confirm deletion; Saved buttons persist |
| Style DNA | Guided preferences → everyday details → optional inspiration → review/save; private multi-image analysis, safe draft merging and exact approvals |
| Reference photos | Real credited Unsplash stock examples for suggested missing clothes, separate from owned garments |
| Dashboard | Actual counts and recent saved looks, compact shortcuts |
| Pinterest | Optional board bookmark only; no OAuth, Pin fetching or synchronization |

Milestones 1 and 2 and the latest Milestone 3 photo/chat follow-ups passed user testing. The user authorized moving from Milestone 4 to Milestone 5. Milestone 5 repository preparation is implemented; **public deployment and production acceptance remain pending**. Moving ahead is not a claim that every earlier hosted test was independently rerun.

## Stack and architecture

One Next.js App Router application: React, TypeScript, Tailwind, Lucide, shared UI components, Zod, Supabase Auth/Postgres/private Storage, and the official OpenAI JavaScript SDK with Responses API. Unsplash is the optional reference-photo provider. `package.json` and `package-lock.json` define exact compatible dependencies; the deployment guide uses Node.js 22.x.

Protected server pages and authenticated `/api/wardrobe`, `/api/stylist`, `/api/outfits`, `/api/style-dna` and `/api/profile` route handlers use the current user's Supabase session. Ownership filters and row-level security protect records. Uploaded images use owner-prefixed private paths and signed previews. OpenAI and Unsplash credentials remain server-side. Sensitive aggregate writes use checked PostgreSQL functions and transactions.

Agent workflow:

```text
Natural-language request → authenticated, budgeted turn
→ bounded model reasoning → allowlisted tool + strict argument validation
→ persisted sanitized log → owner-checked database/Storage operation
→ structured tool result returned to model → persisted reply and actual cards
```

The agent can retrieve/edit owned clothes, generate grounded combinations, save/modify looks, retrieve preferences, analyze uploaded inspiration, prepare approvals, and search stock references. See `lib/stylist/tools.ts` for schemas and descriptions. It never executes arbitrary shell commands/code. Up to three complete outfit candidates are allowed; each requires a dress OR top and bottom, plus shoes. Missing items produce an honest limitation, not invented IDs.

## Prompt engineering

Dedicated prompts in `lib/prompts/` cover clothing recognition, outfit generation, stylist orchestration and inspiration analysis. They demonstrate roles, explicit contracts, strict structured output, tool-selection rules, few-shot multi-step workflows, retrieved-fact grounding, untrusted-image/text boundaries, ambiguity resolution, error recovery and honest reporting. Prompt rules are backed by programmatic schemas, ownership checks, transactional mutations and server-verified approvals.

## Local setup

1. Use Node.js 22.14+ within the 22.x line. Open a terminal in the repository root.
2. For a new checkout, create `.env.local` from `.env.example`; preserve an existing private file. Follow [Auth setup](docs/AUTH_SETUP.md), [wardrobe setup](docs/MILESTONE_2.md), and the guides below for the actual service configuration. Never paste credentials into chat.
3. Install and start:

```powershell
npm ci
npm run check:config
npm run dev
```

Open http://localhost:3000. For localhost-only development, `npm run dev -- --hostname 127.0.0.1` avoids listening on all network interfaces. Restart after changing local environment values.

| Environment variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable/legacy anon key, never service-role/secret key |
| `OPENAI_API_KEY` | Server-only API credential |
| `OPENAI_MODEL` | Already-tested vision/function-capable model; example `gpt-5.4-mini` |
| `NEXT_PUBLIC_APP_URL` | Exact website origin; localhost locally, HTTPS production origin on Vercel |
| `UNSPLASH_ACCESS_KEY` | Optional server-only reference-search credential |
| `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` | Reserved future integration; unused and unnecessary today |

`npm run check:config` prints variable names/status without values and makes no live provider calls. `npm run check:config -- --production` additionally rejects a localhost/non-HTTPS app origin; run it in an environment configured with the production values. The build automatically rejects a provided privileged browser key. No Supabase service-role key is required.

## Supabase migrations and setup guides

Run each migration **once, in order**, using Supabase SQL Editor. Files in Git do not apply themselves to the hosted project. Existing profiles, wardrobe, chats and looks are preserved by follow-ups.

| Migration | Purpose | Guide |
| --- | --- | --- |
| 0001 | Foundation, owner policies, private buckets | [Auth setup](docs/AUTH_SETUP.md) |
| 0002 | Wardrobe safety/budgets | [Milestone 2](docs/MILESTONE_2.md) |
| 0003 | Agent/atomic mutations/approvals | [Milestone 3](docs/MILESTONE_3.md) |
| 0004 | Separate chats and saved/lookbook follow-ups | [Chat updates](docs/CHAT_UPDATES.md) |
| 0005 | Reference-photo persistence/budgets | [Photo setup](docs/PHOTO_SETUP.md) |
| 0006 | Style DNA uploads/analyses/approvals | [Milestone 4](docs/MILESTONE_4.md) |

Milestone 5 requires **no new migration**. `supabase/checks/release.sql` is a read-only hosted readiness check. Other SQL checks use isolated fixtures and roll back. Keep RLS enabled and buckets private; never loosen policies to work around an error.

## Safety, privacy and limits

- All generated/saved combinations reference authenticated owned items. Stock references and inspiration never become wardrobe pieces automatically. No virtual try-on or fabricated outfit photos.
- Destructive actions and Style DNA replacements require exact, persisted, user-bound approvals with expiry/version checks. Chat text cannot approve them. Saves are idempotent and outfit mutations atomic; no blind mutation retries.
- Raw keys, credentials, image bytes and unnecessary private content are excluded from action logs. Retrieved descriptions/images are untrusted. `store:false` is used for OpenAI requests but is not a promise of zero provider retention.
- New uploads: JPEG/PNG/WebP, **4 MB** maximum. Existing stored photos up to the former 10 MB limit are retained; combined inspiration input is capped at 20 MB. Vercel's body limit is why new uploads are smaller.
- Cost controls include 10 clothing analyses/user/hour, 10 stylist turns/user/hour, bounded tool iterations and single-item writes, 10 new inspiration analyses/user/hour (up to five photos together; cached repeats), and 45 shared reference searches/rolling hour. Provider quotas can still stop requests.
- Signed previews expire. History reads don't repeat reference searches or AI analyses. Refresh saved data to renew private preview links.
- Keyboard/mobile navigation, skip-to-content, focus outlines, reduced-motion support, safe error pages and a 404 are included. Browser/mobile acceptance is still part of release testing.

## Testing and CI

```powershell
npm run lint
npm test
npm run build
npm run typecheck
npm audit --omit=dev
```

On a clean checkout, build generates Next route types before the standalone type check. Build also validates TypeScript. Automated tests mock external providers and execute real PostgreSQL migrations/functions/RLS through a test-only PGlite harness with minimal mocked Auth/Storage schemas. They do not prove hosted email delivery, real provider access or browser interaction.

With a local server already running:

```powershell
node tests/auth-smoke.mjs http://localhost:3000
node tests/wardrobe-smoke.mjs http://localhost:3000
node tests/stylist-smoke.mjs http://localhost:3000
node tests/release-smoke.mjs http://localhost:3000
```

These checks use no cookies, live mutations or paid calls. GitHub Actions repeats lint/tests/build/types after pushing the workflow; it does not deploy. See [release review](docs/RELEASE_CHECKS.md) for scope and [deployment](docs/DEPLOYMENT.md) for actual hosted acceptance.

## Deployment and demo

Use the detailed staged [Vercel deployment guide](docs/DEPLOYMENT.md). The user already connected Vercel to GitHub; next is reviewing/pushing the release and importing `SarahAHuynh/Outfyt`. Production environment values, exact Supabase redirect URLs, the assigned domain, actual runtime settings and production tests still need confirmation. No public deployment is claimed yet.

[DEMO_GUIDE.md](DEMO_GUIDE.md) provides a reproducible 1–2 minute class demo, preparation checklist and failure plan. [Demo data template](demo/wardrobe.template.json) is an optional manual-entry starting point for a separate account; replace examples with garments you actually own. It is never loaded automatically into anyone's account.

## Known limitations and future work

Pinterest synchronization is not connected. If official access is later approved, it needs OAuth, pagination, stable Pin IDs, new/removed Pin reconciliation and reviewed profile changes; a board URL alone cannot provide that access. Review applicable content-use requirements before AI analysis of API-derived content.

Unsplash stock photos may differ from requested colors/garments and are not verified shopping listings. Demo API allowance/production approval must be reviewed before public release. Provider access, email delivery/SMTP and hosting quotas remain account-dependent.

Large-account pagination, exports/account deletion, broad browser automation and an absolute abort mechanism across every in-flight agent operation are future work. Current loop deadlines are checked between operations; inspect action history after an interruption. No background sync jobs are installed.

Future sessions: read `AGENTS.md` and `codex.md`. Update the handoff with actual changes/results, give manual test cases and a short commit message after each phase, and guide external setup one major stage at a time.
