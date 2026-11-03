# Outfyt

Outfyt is a personal AI styling studio: **your closet. your aesthetic. your way.** This repository currently contains Milestone 1, a polished Next.js foundation with the app navigation, core empty states, Supabase client setup, and the initial database/storage security migration.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, Zod, and Supabase Authentication/Postgres/Storage. AI features are intentionally reserved for Milestone 2–3, so the foundation does not pretend that styling actions are already connected.

## Run locally

1. Install Node.js 22.14+ (the automated tests use Node's TypeScript stripping support).
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key from Supabase Project Settings → API.
3. Run `npm install`, then `npm run dev` and open http://localhost:3000.
4. Run `npm run typecheck` and `npm run build` before committing.

The SQL in `supabase/migrations/0001_initial_schema.sql` is designed to run in Supabase SQL Editor. It creates the user-owned tables, RLS policies, and private image buckets. Email/password signup, login, confirmation, logout, and session protection are implemented. See [the authentication setup guide](docs/AUTH_SETUP.md) for configuration and manual test cases. No privileged Supabase key belongs in the browser.

## Milestone 1 status

Completed: responsive landing page, dashboard, closet, AI Stylist, Style DNA, Lookbook, Settings, navigation, empty states, environment template, Supabase browser/server clients, schema, ownership policies, and private storage policies.

Supabase database and dashboard authentication settings have been verified by the user. Pending: local environment configuration and live authentication tests. Milestone 1 remains under review; wardrobe/AI/style/profile-editing controls are foundation placeholders. GitHub setup and the remaining foundation UI review still need completion before Milestone 2.
