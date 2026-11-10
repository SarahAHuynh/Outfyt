# Outfyt: project memory and session handoff

Last updated: November 10, 2026 (America/Los_Angeles).

This file is the portable project handoff. Read it before continuing in a new session. Keep it and `AGENTS.md` with the repository when moving machines or starting elsewhere. The conversation and original attachment may not be available there; the essential requirements are captured here. Current user instructions override older notes.

## User vision

Outfyt is a real AI-powered digital wardrobe and personal styling application for a CS4680 Prompt Engineering college project.

**Tagline:** your closet. your aesthetic. your way.

The app helps young adults create outfits from clothes they already own while understanding their personal aesthetic. It should feel like a polished lifestyle/fashion product, with reliable operations and understandable feedback. The user has programming experience but wants teaching and detailed guidance for external service configuration.

The intended experience:

- Upload actual clothing photos; AI suggests editable clothing attributes.
- Organize, filter, edit, and delete owned wardrobe pieces.
- Ask for personalized outfits in natural language, grounded in the real closet and Style DNA.
- Save, favorite, rename, and modify outfits, including through conversation.
- See actual garment photos in outfit cards and review real agent actions.
- Build a persistent Style DNA profile with multiple aesthetics, colors, clothing preferences, dislikes, comfort preferences, and notes.
- Optionally upload inspiration images and review AI-proposed style changes before applying them.
- Optionally connect Pinterest later using authorized official access. Pinterest must never be required for onboarding or core features.
- See real reference photos when the stylist recommends missing clothes. References are distinct from owned garments and saved outfits.

This must demonstrate a working agent, not text pretending to execute actions. The course rubric requires LLM integration, validated action interpretation/execution, visible progress, errors, confirmations, and action logging. Keep dedicated prompts easy to explain, with grounding, structured output, few-shot workflows, tool-selection rules, uncertainty handling, and untrusted-input boundaries.

## Required collaboration workflow

1. Work one milestone at a time. Explain its goal and affected files, implement the work, run appropriate checks, fix failures, and stop for review.
2. End every implementation phase with concrete manual test cases and expected outcomes. The user explicitly requested this throughout development, including smaller follow-up phases.
3. After each completed milestone, provide a **short suggested commit message**. The user wants this consistently without having to ask. Also provide one for a completed follow-up phase when useful. Do not commit or push automatically; the user may still have earlier work uncommitted.
4. Summarize **Completed**, **Tested**, **My actions**, and **Next**, using enough detail for the situation. Never confuse local tests with hosted verification or user acceptance.
5. Wait for user review/approval before starting the next milestone. Continue routine work within an already authorized phase without unnecessary permission questions.
6. For setup, provide thorough step-by-step instructions, one major external process at a time. State the exact URL, dashboard/menu/button, names/settings, where values come from, destination file or environment-variable name, terminal and working directory, exact commands, expected output, and common fixes. Do not merely link documentation or say "configure Supabase."
7. Verify current official documentation for changing service requirements. If dashboard labels cannot be verified, say so. Do not invent credentials or verification results.
8. When the user must act in their account, explain the action and success criteria, then pause that dependent setup work for confirmation or error text. Complete independent authorized work where possible.
9. Never request keys, tokens, passwords, confirmation links, or privileged credentials in chat. Keep secret values out of documentation, screenshots, logs, and commits.
10. Keep explanations plain and practical. Be concise for normal updates but thorough for setup. Fix errors where possible before asking the user to troubleshoot.
11. Update this file in the same working change whenever the app or relevant decisions change. Record new verification results, outstanding tasks, and the next review point before ending the session. Do not rely on conversation memory alone.

These are ongoing instructions, not an installed background updater. `AGENTS.md` directs future repository-aware Codex sessions to read and maintain this file. A session without access to this repository needs these files supplied explicitly.

## Current checkpoint: resume here

**Do not rebuild the app or restart Milestone 1.** Milestones 1 and 2 passed user acceptance. Milestone 3 and follow-up fixes are implemented; the latest photo-reference rollout is awaiting the user's hosted SQL setup and manual acceptance results. Milestone 4 has not started.

Most recent implementation: Unsplash reference photos in AI Stylist. The user said **"Unsplash key ready"**. One real search succeeded with HTTP 200 and one photo result; that check used one request, and the remaining allowance reported then was 49. This is historical, not the current quota.

Last instructions given to the user:

1. In Supabase SQL Editor, run `supabase/migrations/0005_reference_photos.sql` once, after 0004.
2. Run `supabase/checks/photos.sql`; expect PASS.
3. Restart `npm run dev`.
4. Ask for bottoms with image examples, verify photo/credit links, refresh and return to an older chat, verify references were not added to the closet/lookbook, and regression-test actual outfit saves.

**Not yet confirmed:** whether the user applied 0004/0005 in hosted Supabase and passed the latest chat/photo acceptance tests. Do not mark these complete based on local tests. The user has not reported new errors since that handoff.

Next feature milestone, only after the current phase passes and the user approves: **Milestone 4, Style DNA**.

## Milestone roadmap and status

| Milestone | Scope | Status |
| --- | --- | --- |
| 1: Foundation | Next.js, navigation/pages, Supabase schema, private storage policies, authentication, initial service setup | User acceptance passed |
| 2: Digital Wardrobe | Secure image upload/preview, real AI clothing recognition, editable results, wardrobe CRUD/filtering | User explicitly said "milestone 2 passes" |
| 3: AI Stylist Agent | Real tool calling, validated owned outfits, lookbook, modifications, approvals, logs | Implemented and locally verified; user has exercised conversations and saved looks; full latest acceptance not confirmed |
| 3 follow-ups | Persistent Saved buttons, separate chats, lookbook query fix, real Unsplash recommendation photos | Implemented; latest hosted migration/manual review pending |
| 4: Style DNA | Preferences UI, inspiration uploads, AI analysis, persistent profile, style-aware generation, optional Pinterest URL UI | Not started as a full feature; foundational schema/tools already exist |
| 5: Finalization and Deployment | Integration/security checks, responsive polish, production setup, Vercel, documentation, demo data; authorized Pinterest refresh if available | Pending |

Do not mistake existing Style DNA page/layout or foundational tools for completed Milestone 4. Deployment and Pinterest synchronization are not verified or complete.

## Accepted design and conversation decisions

- Cream/lavender fashion aesthetic, rounded cards, serif display headings, readable layouts. The user wants further visual polish as the app evolves.
- Center Settings content instead of hugging the left edge.
- Keep dashboard actions (Build your closet, Define your Style DNA, Start your lookbook) compact.
- Analyze photo must look clearly clickable: dark purple `#594273`, hover `#47345d`, with a spinner/progress during AI analysis.
- Place the green analysis-success banner at the top, immediately below the Add to your closet heading. Earlier bottom-placement requests were superseded.
- AI Stylist Save look changes to **Saved** with a checkmark after database success, stays saved after refresh, and is disabled for already saved candidates, including agent saves.
- New chat and Previous chats must preserve separate histories. Wardrobe, Style DNA, and saved looks remain shared across a user's chats.
- The user asked for image examples of recommended bottoms, not only written suggestions, and preferred the cheapest option. Implemented real stock-photo references instead of paid AI image generation or shopping APIs.
- Example user style request: laid-back fall tomboy look in blue, white, and green. Their reported closet then had navy/white tops, olive zip-up outerwear, and black loafers but lacked bottoms. This was a conversation example, not seed data or a permanent assumption about their current closet.
- Never invent a complete outfit when essential owned clothes are missing. Recommend additions honestly, with reference cards where available.

## Implementation map

One Next.js App Router project with React, TypeScript, Tailwind CSS, Lucide, shared UI components, Zod, Supabase Auth/Postgres/Storage, and the official OpenAI JavaScript SDK/Responses API. Check `package.json` and lockfile for actual installed versions before making dependency changes.

At this checkpoint: Next.js 16.4.5, React 19, Tailwind 3, Supabase SSR 0.5.2, Supabase JS 2.57.0, storage-js override 2.12.2, OpenAI SDK 7.52 range, Zod 4. `OPENAI_MODEL` example is `gpt-5.4-mini`; respect the configured model and verify account access before changing it.

| Location | Purpose |
| --- | --- |
| `app/(app)/` | Protected Dashboard, Closet, Stylist, Style DNA, Lookbook, Settings |
| `app/api/wardrobe/` | Wardrobe CRUD, image analysis, deletion handling |
| `app/api/stylist/` | Chat requests/history, chat creation, pending-action decisions |
| `app/api/outfits/` | Saved-look operations |
| `lib/auth/`, `lib/supabase/` | Authentication, email feedback, session-aware clients |
| `lib/ai/` | Clothing vision analysis |
| `lib/wardrobe/` | Clothing schemas, uploads, ownership, storage/read helpers |
| `lib/stylist/tools.ts` | Strict allowlisted function schemas and sanitized argument logging |
| `lib/stylist/loop.ts` | Bounded Responses API tool loop; actual results returned to model |
| `lib/stylist/server.ts` | Authenticated context, executor, persistence, selected-chat views |
| `lib/stylist/generation.ts` | Structured outfit generation and inspiration analysis |
| `lib/stylist/outfits.ts` | Explicit owner-filtered outfit/relationship queries |
| `lib/stylist/photos.ts` | Unsplash search, validated hotlinks/attribution, safe failures |
| `components/stylist/` | Chat, outfit cards, pending-action cards, reference-photo cards |
| `lib/prompts/` | Stylist, clothing analysis, outfit generation, Style DNA analysis prompts |
| `supabase/migrations/`, `supabase/checks/` | Ordered schema updates and rollback-only SQL checks |
| `tests/` | Mocked-provider tests, embedded PostgreSQL tests, HTTP smoke scripts |

## Core behavior and safeguards to preserve

- All wardrobe, outfits, history, approvals, and logs are owner-scoped. RLS and server checks enforce this independently of prompts. Private wardrobe images use signed URLs.
- Generated/saved outfit IDs must exist in the authenticated user's closet. Validate duplicates, required/excluded pieces, and ownership. A complete outfit needs a dress OR a top and bottom, plus shoes.
- Real owned garment photos appear in outfit cards. No virtual try-on or fabricated images of the user's outfits.
- Tools retrieve, create, update, generate, save, prepare deletions, and propose preferences. The model gets structured execution results before reasoning continues. Never report an operation as successful until persistence confirms it.
- Destructive operations and Style DNA changes use persisted, user-bound, immutable approvals with version checks and ten-minute expiry. Chat text such as "yes" cannot execute an approval. Bulk writes are not enabled.
- Stable request/candidate IDs, atomic outfit RPCs, and optimistic timestamps protect against duplicate/stale mutations. Do not add blind retries for writes.
- Logs retain sanitized IDs/counts/status/errors, not API keys, raw private image content, or encrypted reasoning. Treat retrieved descriptions and image text as untrusted data.
- Existing limits include 10 stylist turns/user/clock hour, one active turn/user, 8 reasoning rounds, 12 tool calls, one outfit-generation batch, one inspiration analysis, one clothing write, and one outfit write per turn. Active turn locks expire after five minutes. Recheck code before changing budgets.
- UI progress streams actual tool stages over NDJSON. `store:false` is used for OpenAI requests; do not claim this guarantees zero provider retention.

### Chat and lookbook fixes

The reported Open lookbook database error was traced to ambiguous embedded PostgREST joins: outfit_items has both simple and composite ownership relationships to outfits. `readSavedOutfits` uses separate, explicitly owner-filtered queries; do not restore the ambiguous embed.

Migration 0004 preserves old messages under **Previous conversation**. Chats have first-message titles and `/stylist?chat=...` URLs. Messages, candidates, pending approvals, and logs are scoped to the selected owned chat. Creating a new chat does not erase outfits/history or call the model.

### Reference photos

The `search_reference_photos` tool automatically accompanies missing-clothing recommendations or requested image examples. It makes a single focused Unsplash search per turn and returns up to three stock photos. The model receives availability/count, not an assertion that it inspected the images.

- Server-only `UNSPLASH_ACCESS_KEY`; no secret in browser bundles or URLs.
- API-provided direct hotlinks, photographer/Unsplash credits with referral links, validated HTTPS hosts, loading-failure fallback.
- Label: **Style inspiration — not in your closet**. Never treat these as owned garments, exact verified matches, shopping listings, or generated photos.
- References persist against the owning turn and reappear after refresh/chat switching. History reads do not issue new search API requests.
- Database reservation permits at most 45 searches across the project in a rolling hour; failed searches count. One reservation/search per turn. This leaves headroom within the documented Demo allowance of 50/hour but does not account for other apps sharing the key.
- Missing keys, timeouts, empty results, quota/authorization errors, and unsafe provider URLs fail honestly while written recommendations remain available.
- No import/save/download feature for reference photos. Implement required download-event tracking before adding future import/selection behavior that requires it.
- Pexels was initially proposed; official guidance checked November 6 said new API keys were paused, so we chose Unsplash. This is historical; verify current provider policies before new setup advice.

## Setup and migrations

Existing local project path: `C:\Users\sarahhuynh\Outfyt`; shell: PowerShell. On another machine use the actual checkout path, not this user's absolute paths.

Keep `.env.local` private and ignored. Start with `.env.example` only when setting up a new environment; never overwrite an existing secret file. Variable names:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public project connection values.
- `OPENAI_API_KEY`, `OPENAI_MODEL`: server-side AI configuration.
- `NEXT_PUBLIC_APP_URL`: local/production app URL.
- `UNSPLASH_ACCESS_KEY`: server-only public-search access credential.
- `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`: optional future setup; do not claim integration is enabled.

A privileged Supabase service-role key is not required for the current app. Never add one to bypass RLS failures. A ChatGPT subscription is separate from OpenAI API billing; guide a small API budget when new account setup is actually needed.

The user confirmed Supabase project creation, initial database checks, auth settings, and working signup confirmation. Clothing analysis worked and passed user tests, establishing earlier OpenAI setup. Unsplash key readiness and a live search were confirmed. GitHub push/deployment state and custom SMTP configuration are not established by this handoff; inspect or ask only when relevant.

| Migration (run once, in order) | Purpose | Relevant SQL check |
| --- | --- | --- |
| `0001_initial_schema.sql` | Foundation, profile trigger, owner policies, storage | `foundation.sql` |
| `0002_wardrobe_safety.sql` | Wardrobe deletion safety and analysis budgets | `wardrobe.sql` |
| `0003_stylist_agent.sql` | Turns/messages/candidates, checked mutations, approvals, agent budgets | `stylist.sql` |
| `0004_chat_sessions.sql` | Separate chats and legacy-history preservation | `chats.sql` |
| `0005_reference_photos.sql` | Private reference persistence and shared search reservation | `photos.sql` |

These files live in `supabase/migrations/` and `supabase/checks/`. Repository migration files do not prove they were run in hosted Supabase. Give SQL Editor steps and verification instructions for the specific missing migration; do not rerun old migrations or delete data. SQL check fixtures roll back; no real emails/model calls are made by them.

### Previously discussed troubleshooting

- `npm run dev` on Windows prompted for firewall/admin permission when exposing a network address. It was later reported working. For localhost-only development, `npm run dev -- --hostname 127.0.0.1` can avoid unnecessary LAN exposure; do not disable the firewall or promise that this suppresses every system prompt.
- Supabase storage import failed to resolve `iceberg-js`. Current package overrides/dependency and Turbopack alias address it. Do not casually remove those compatibility settings.
- Next.js warned that middleware is deprecated in favor of proxy. Inspect the current convention before assuming the migration is still outstanding.
- Signup emails arrived but resend confirmation emails did not. Default sender quota feedback was improved: historically 2 emails/hour across the project, and no invented countdown when the provider supplies no reset time. Verify current limits if revisiting. Do not infer a timer from the user's last click. SMTP/template restrictions were discussed, but successful custom SMTP setup was not confirmed.

## Verification and manual review

Last verified application implementation before this documentation handoff:

- **56 automated tests passed**, including mocked provider behavior and PGlite execution of all five migrations and SQL checks.
- Lint, TypeScript checking, and production build passed.
- One live Unsplash search returned HTTP 200 and a photo. Automated AI tests use mocked OpenAI; do not claim live model requests were made as part of that run.
- Earlier auth/wardrobe/stylist smoke checks passed. These do not replace signed-in hosted acceptance tests.

These are historical results, not checks rerun automatically in a fresh session. The November 10 handoff change is documentation-only; no application test rerun is needed solely for it.

Standard commands from the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Install dependencies for a new checkout; do not reinstall unnecessarily in an existing working environment.

For meaningful application changes, run appropriate checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` uses tsx with external providers mocked, and a test-only PGlite database with minimal mocked Supabase Auth/Storage schemas. It exercises actual PostgreSQL policies/functions but does not prove hosted email/storage behavior. Windows sandbox workers may fail with `spawn EPERM`; request the required execution approval and rerun instead of treating that as an application bug or bypassing sandbox restrictions. Next may regenerate `next-env.d.ts`; preserve unrelated user changes.

Optional signed-out smoke check with an already running server:

```powershell
node tests/stylist-smoke.mjs http://localhost:3000
```

### Current pending user test cases

| Action | Expected result |
| --- | --- |
| Apply 0005 after 0004, then run photos.sql | Migration succeeds; SQL check returns PASS |
| Ask "Recommend only bottoms for a laid-back fall tomboy look in blue, white and green. Show image examples." | Search status, helpful advice, up to 3 credited reference cards or honest no-results/service error |
| Open photo and photographer links | Correct Unsplash pages open |
| Refresh, create a new chat, then return to the earlier chat | References/history remain in the original conversation |
| Check Closet and Lookbook after photo recommendations | No reference images added as owned clothes or saved looks |
| Generate/save an actual closet outfit, refresh, open Lookbook | Saved button persists; look and actual garment photos load without the former database error |
| Request a closet-only outfit | Existing outfit behavior works without an unnecessary reference search |

At review, include a short suggested commit message reflecting the actual staged scope. Example for the photo phase alone: `Add Unsplash reference photos to stylist`. Inspect uncommitted changes before suggesting a message for a combined commit; do not claim anything was committed or pushed.

## Next milestone requirements

After current acceptance and approval, Milestone 4 should implement editable personal preferences, optional secure inspiration uploads, real AI analysis, suggested changes that can be edited/approved, persistence, and use of that profile in recommendations. Preserve explicit user choices and comfort preferences; support multiple aesthetics rather than forcing one label.

Pinterest remains optional. A board URL alone does not authorize image access or prove analysis. If official API access is unavailable, save the URL as a reference with an honest not-configured status and keep manual inspiration uploads working. Any later sync must use supported OAuth/scopes, pagination, stable Pin IDs, new/removed Pin reconciliation, no repeated unchanged-image analysis, credential/error handling, and user review before preference replacement. Start with manual refresh; no premature background jobs.

Milestone 5 includes responsive polish, integration/security/error review, GitHub/Vercel setup with detailed instructions, production environment variables and Supabase redirects, live auth/uploads/agent tests, runtime/streaming limits, README, optional isolated demo data, and a reproducible 1–2 minute class demonstration. Never deploy or publish without the required user authorization.

## Supporting guides

- `README.md`: project overview and local workflow. Some milestone counts/status text predates follow-ups; prefer verified code and this dated checkpoint when reconciling it.
- `docs/AUTH_SETUP.md`: authentication setup and tests.
- `docs/MILESTONE_2.md`: wardrobe setup/testing.
- `docs/MILESTONE_3.md`: agent architecture, setup, safety, acceptance checklist; original test count predates later additions.
- `docs/CHAT_UPDATES.md`: chat/save/lookbook changes and regression tests; its final photo-status note predates integration.
- `docs/PHOTO_SETUP.md`: current Unsplash setup, migration, limits, and test cases.
- `DEMO_GUIDE.md`: class demonstration workflow.

## Handoff maintenance checklist

Before ending a future application-change session, update the date and current checkpoint; record changed behavior/files, migrations/env/setup needs, exact verification results, pending user tests, acceptance status, and next step. Preserve still-relevant product/workflow decisions. Replace superseded status instead of accumulating contradictory notes. Keep secrets and private records out. Supply user test cases and a short commit message at phase completion, then pause for milestone review.
