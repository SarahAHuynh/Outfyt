# Outfyt

Outfyt is a personal AI styling studio: **your closet. your aesthetic. your way.** Milestones 1 and 2 and the latest Milestone 3 chat/photo follow-ups passed user acceptance tests. Milestone 4 adds real Style DNA preferences and inspiration analysis; its hosted migration and manual acceptance tests are pending.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, Zod, and Supabase Authentication/Postgres/Storage. Clothing recognition uses the official OpenAI JavaScript SDK and Responses API with validated structured output. The conversational styling agent uses strict function calling, real database operations and persistent, user-approved destructive actions.

## Run locally

1. Install Node.js 22.14+; tests use the tsx runner and an isolated PostgreSQL harness.
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key from Supabase Project Settings → API.
3. Run `npm install`, then `npm run dev` and open http://localhost:3000.
4. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before committing.

The SQL in `supabase/migrations/0001_initial_schema.sql` is designed to run in Supabase SQL Editor. It creates the user-owned tables, RLS policies, and private image buckets. Email/password signup, login, confirmation, logout, and session protection are implemented. See [the authentication setup guide](docs/AUTH_SETUP.md) for configuration and manual test cases. No privileged Supabase key belongs in the browser.

## Milestone status

Milestone 4: follow [Style DNA setup and tests](docs/MILESTONE_4.md). Run `0006_style_dna.sql` once after 0005, then `supabase/checks/style-dna.sql`. Preferences require review and approval; private inspiration uploads support combined AI analysis and cached suggestions. Manual choices, comfort and notes are preserved when adding suggestions to a draft. Pinterest board URLs are optional reference bookmarks, with synchronization explicitly not configured.

Style DNA now uses a guided flow: aesthetic → everyday details → optional inspiration → review/save. One panel appears at a time, primary buttons are dark purple, and returning users see their saved summary. Extra options stay collapsed. This UI follow-up requires no additional migration.

Latest chat follow-up: the lookbook relationship query is fixed, saved suggestions show a persistent Saved state, and New chat / Previous chats preserve separate conversations. Apply migration `0004_chat_sessions.sql` after 0003 and follow [chat update checks](docs/CHAT_UPDATES.md). Free Unsplash clothing reference cards are connected through a server-only search tool: follow [PHOTO_SETUP.md](docs/PHOTO_SETUP.md), apply `0005_reference_photos.sql`, and run `supabase/checks/photos.sql`. Reference photos stay in their chat and are separate from owned clothing and saved outfits.

Architecture: protected Next.js pages and authenticated `/api/wardrobe`, `/api/stylist`, and `/api/outfits` route handlers use the user's Supabase session. Photos use private signed URLs. AI calls stay on the server. Shared Zod schemas validate clothing, tool inputs and outfit outputs. Checked SQL RPCs handle budgets, atomic outfit/relationship writes, immutable approvals and action logs. The model receives actual tool results before it continues reasoning.

Prompt engineering: dedicated prompts in `lib/prompts/` cover clothing analysis, AI Stylist, outfit generation and Style DNA analysis. They use roles, few-shot workflows, strict output contracts, retrieved-fact grounding, explicit tool-selection/approval rules, uncertainty handling and untrusted-data boundaries. Programmatic schema, ownership, ID and approval checks enforce safety independently of prompts.

Completed: responsive landing page, dashboard, closet, AI Stylist, Style DNA, Lookbook, Settings, navigation, empty states, environment template, Supabase browser/server clients, schema, ownership policies, and private storage policies.

Milestone 2 real photo recognition and wardrobe operations passed user review. Milestone 3 agent/lookbook implementation is documented in [Milestone 3 instructions](docs/MILESTONE_3.md), with follow-up chat and reference-photo guides above. Milestone 4 is implemented and awaiting hosted setup/user review. Migrations are not applied automatically to your live project. Follow [the demo guide](DEMO_GUIDE.md) for a reproducible class demonstration. Authorized Pinterest synchronization remains optional and unconfigured; finalization and deployment remain Milestone 5.
