# Outfyt

Outfyt is a personal AI styling studio: **your closet. your aesthetic. your way.** Milestone 1 authentication and layout tests have passed user review. Milestone 2 digital wardrobe is implemented locally and awaiting its Supabase migration, OpenAI setup, and live acceptance tests.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, Zod, and Supabase Authentication/Postgres/Storage. Clothing recognition uses the official OpenAI JavaScript SDK and Responses API with validated structured output. The conversational styling agent remains Milestone 3.

## Run locally

1. Install Node.js 22.14+ (the automated tests use Node's TypeScript stripping support).
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key from Supabase Project Settings → API.
3. Run `npm install`, then `npm run dev` and open http://localhost:3000.
4. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before committing.

The SQL in `supabase/migrations/0001_initial_schema.sql` is designed to run in Supabase SQL Editor. It creates the user-owned tables, RLS policies, and private image buckets. Email/password signup, login, confirmation, logout, and session protection are implemented. See [the authentication setup guide](docs/AUTH_SETUP.md) for configuration and manual test cases. No privileged Supabase key belongs in the browser.

## Milestone status

Architecture: protected Next.js pages render the studio; authenticated `/api/wardrobe` route handlers validate requests and use the user's Supabase session for database/Storage access. Images use private, temporary signed URLs. OpenAI calls stay on the server. Shared Zod schemas keep AI suggestions and manually edited attributes consistent. Dedicated SQL RPCs handle the shared analysis budget and atomic delete approval checks.

Prompt engineering: `lib/prompts/clothing-analysis.ts` defines the catalog role, visual-evidence constraints, few-shot examples, strict output instructions, uncertainty handling and resistance to instructions embedded in images. The model proposes attributes only; users review them before any save. The Responses API uses Zod-backed structured output and validates the parsed response again.

Completed: responsive landing page, dashboard, closet, AI Stylist, Style DNA, Lookbook, Settings, navigation, empty states, environment template, Supabase browser/server clients, schema, ownership policies, and private storage policies.

Milestone 1 authentication tests and centered Settings/compact dashboard layout were verified by the user. Milestone 2 adds real wardrobe management, private uploads and editable AI clothing recognition. Follow [Milestone 2 setup and acceptance tests](docs/MILESTONE_2.md), starting with migration `0002_wardrobe_safety.sql`. Live database/AI verification remains pending; no OpenAI key has been configured or billed by the agent. Profile editing and other later-feature controls remain placeholders.
