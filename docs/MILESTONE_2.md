# Milestone 2: Digital wardrobe

## Implemented in the repository

- Private clothing-photo uploads (JPEG, PNG, WebP; 10 MiB maximum), with client previews and server size/MIME/signature checks.
- Editable OpenAI vision suggestions using the official JavaScript SDK, Responses API, Zod structured output, and the dedicated prompt in `lib/prompts/clothing-analysis.ts`.
- Manual entry with or without a photo; AI failure never prevents manual entry.
- Persistent closet grid, name/tag search, category/color filters, detail editing, and real dashboard counts.
- Short-lived, user/item/version-bound delete approvals. A piece in a saved outfit cannot be deleted until it is removed from that outfit. Expired/stale approvals fail; repeated successful confirmations do not repeat the database mutation.
- A database-backed budget of 10 analysis attempts per signed-in user per clock hour. Failed provider calls still consume attempts. The SDK retries a transient provider failure at most once; database mutations are not automatically retried.
- Clear error notifications, loading skeletons, keyboard-accessible native dialogs, and private signed photo URLs that expire after one hour.

No OpenAI calls are made during ordinary builds/tests; automated tests mock the provider. Live uploads, SQL functions/RLS and image analysis still need the manual checks below. No new service-role key is needed.

## Stage 1: Supabase migration

1. Open https://supabase.com/dashboard and select `outfyt`.
2. Open SQL Editor and create a new query called `Outfyt milestone 2` (if query naming is available).
3. Paste the complete contents of `supabase/migrations/0002_wardrobe_safety.sql` and Run once. Do not rerun the original migration.
4. Expected: the transaction completes without errors. Two extra user-owned tables and three authenticated RPCs exist. Direct wardrobe deletes now require the confirmation RPC.
5. Open another query, paste `supabase/checks/wardrobe.sql`, and Run. Expected: a PASS result, no error. It creates temporary test users/items inside a transaction, checks actual database permissions and RPC behavior, and rolls everything back. It does not send email or call AI. If any statement errors, run `rollback;` before further work and share only the error text.

Do not disable RLS or loosen permissions to fix a migration error. A missing RPC produces an explicit setup message in the app. Continue to the next setup stage only after this stage succeeds.

## Stage 2: OpenAI account and project

Only start this stage after the migration has passed.

1. Visit https://platform.openai.com and sign in or create an API account. Complete organization setup if prompted.
2. Open Settings and select/create the organization you will use. Create a project named `outfyt` using the project selector or Projects settings. Dashboard layout can vary; use the settings search if labels differ rather than assuming an exact button location.
3. Open Billing (https://platform.openai.com/settings/organization/billing/overview). API usage is managed separately from ChatGPT subscription billing. Check whether any eligible subscription credits have been explicitly activated before buying credit; a ChatGPT subscription alone is not proof this API organization is funded.
4. If API billing requires funding, add a payment method and a small initial balance you are comfortable spending, such as $5 if that option is offered. Disable automatic recharge for initial testing if available. Check the actual minimum displayed in your account.
5. In project/organization Limits or Spend settings, set a small spend alert, and a hard spend cap if your account exposes that setting. Read whether the control is an alert or an enforced cap; these are different. Review Usage during testing. Never assume a notification threshold blocks spending.
6. Select the `outfyt` project, open API Keys (https://platform.openai.com/api-keys), and create a secret key named `outfyt-local`. Use project-level credentials. If choosing restricted permissions, permit model listing and Responses creation. Save it directly in your local environment file; do not paste it into chat.
7. Check the official model page and your project's available models for `gpt-5.4-mini`. It supports image input and structured output. If your account cannot use it, report the model-access error without credentials so we can choose a supported vision model. The environment controls the model; the code does not silently switch providers or substitute fake results.
8. In `C:\Users\sarahhuynh\Outfyt\.env.local`, keep the existing Supabase values and set:

```dotenv
OPENAI_API_KEY=YOUR_PROJECT_API_KEY
OPENAI_MODEL=gpt-5.4-mini
```

Do not put this key in a `NEXT_PUBLIC_*` variable. `.env.local` is Git-ignored. Never commit it, log it, or share screenshots containing it. Restart `npm run dev` after changing environment variables.

9. Verify the connection by opening My Closet > Add a piece, selecting an actual clothing photo, then Analyze photo. Expected: editable suggestions appear, but the grid/database has not changed yet. This verifies authenticated API access, vision input, structured output and validation in one real request. The tool-calling verification belongs to Milestone 3, not this milestone.
10. Correct any attributes and Save piece. Expected: a persistent wardrobe card with your real photo. Refresh to verify persistence.

## Manual acceptance tests

| Test | Expected result |
| --- | --- |
| Add a named piece, category and color without a photo | Saves and survives refresh; card shows No photo |
| Select a real JPEG/PNG/WebP photo | Preview appears before any save |
| Cancel the new-item dialog before Save | No wardrobe row or stored image is created |
| Analyze a photo with configured OpenAI access | Editable suggestions appear; nothing is saved automatically |
| Correct the AI name/category/color, then Save | Your corrections, not the original suggestions, persist |
| AI is unconfigured, rejects the image or reaches its limit | Helpful error; manual fields remain usable |
| Choose an SVG, HEIC, empty image or image above 10 MiB | Clear validation error; no wardrobe mutation |
| Add items in two categories/colors; use search and filters | Only matching owned items appear; Clear filters restores the grid |
| Edit a saved item's details | Changes persist after refresh |
| Save an outdated edit from a second tab | Conflict message; newer data is not overwritten |
| Request Delete, then choose Keep piece or Escape | Item remains |
| Confirm Delete | Card disappears; private photo is removed unless a cleanup warning appears |
| Wait over 10 minutes before confirming deletion | Approval is rejected; request deletion again |
| Open two tabs, prepare deletion, edit that piece in the other tab, then confirm | Stale deletion is rejected |
| Repeat a save after a lost response using the same still-open form | No duplicate wardrobe row |
| View Dashboard after adding/deleting pieces | Piece count matches the database |
| Sign in as another test user in a separate browser profile | Cannot see, edit or delete the first user's items or access their private storage path |
| Open an unsigned direct Storage object URL | Private image is inaccessible; a signed URL intentionally grants temporary access until expiry |
| Check mobile layout and keyboard Tab/Escape | Controls fit, focus stays in dialogs, and closing restores focus |

Use the SQL check to test cross-user permissions and the 10-request allowance without consuming real OpenAI requests. For a live two-user signup test, Supabase's default SMTP restrictions still apply; do not create accounts solely to exhaust email quota.

## Checks to run locally

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The JavaScript/TypeScript suite tests schema validation, image metadata/signatures, ownership guards, save retries, failed-upload handling, database-failure cleanup, and Responses parsing/error handling using mocked OpenAI HTTP responses. SQL tests require Supabase and are not claimed to have run by the local test command.

With the app running, `node tests/auth-smoke.mjs http://localhost:3000` and `node tests/wardrobe-smoke.mjs http://localhost:3000` check page redirects, signed-out API rejection, and cross-origin mutation rejection without account credentials or paid API calls.

## Known limits and next milestone

- One image per item. The editor changes attributes; changing an existing saved photo is not implemented yet.
- Clothing photos are sent to OpenAI only when the user selects Analyze photo. `store: false` disables Responses application-state storage, but is not a promise of zero provider retention. See OpenAI data controls.
- The database and Storage cannot share a single atomic transaction. Failed creates attempt cleanup, and uncertain commits keep the photo until the saved state can be verified. A private orphan image can remain if cleanup fails; errors say so. Automated storage cleanup is deferred.
- Image checks validate metadata and signatures, not a full malware scan or image re-encoding pipeline.
- On Vercel, platform request-body limits can be lower than the app's 10 MiB limit. Production deployment needs direct-to-private-storage uploads or a smaller displayed limit before claiming 10 MiB uploads work there. This milestone is locally testable; deployment remains Milestone 5.
- AI limits are per clock hour, not a countdown from the first request. Many accounts could still create aggregate costs, so keep account/billing caps and monitor Usage.
- Chat agents, outfit generation, saved outfit editing and Style DNA inference remain later milestones. Existing saved-outfit relationships intentionally block wardrobe deletion.

Stop for review after this milestone; do not start Milestone 3 until the user approves.

Official references:
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/guides/error-codes
- https://developers.openai.com/api/docs/guides/spend-limits
- https://developers.openai.com/api/docs/guides/chatgpt-api-credits
- https://developers.openai.com/api/docs/guides/your-data
