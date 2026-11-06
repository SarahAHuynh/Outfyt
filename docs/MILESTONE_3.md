# Milestone 3: AI Stylist and lookbook

## Implemented

The AI Stylist uses the official OpenAI Responses API with strict function schemas. It executes real authorized application tools, feeds their results back to the model, and preserves response/reasoning items between steps. Chat history, generated candidates, pending approvals, logs and saved outfits persist in Supabase. No hardcoded outfit suggestions or generated try-on images are used.

The chat streams actual execution stages over NDJSON. Candidate cards show real uploaded clothing photos. The lookbook supports saving, favoriting, renaming, changing combinations and confirmed deletion. The existing OpenAI and Supabase environment settings are reused; no extra key or service-role credential is required.

## One-time database setup

The current version also requires follow-up migration `0004_chat_sessions.sql` after 0003. It preserves existing messages under Previous conversation and enables separate chats. Run `supabase/checks/chats.sql` afterward; see `docs/CHAT_UPDATES.md` for the saved-button and lookbook regression checks.

1. Open https://supabase.com/dashboard and choose `outfyt`.
2. Select SQL Editor and create a new query.
3. Paste all of `supabase/migrations/0003_stylist_agent.sql` and select Run once. Keep migrations 0001 and 0002; do not rerun them.
4. Expected: success with no SQL errors. Four tables are added: `stylist_turns`, `stylist_messages`, `outfit_candidates`, `agent_pending_actions`. RLS and checked RPCs are created. Ordinary direct writes to outfits/outfit-items, Style DNA and agent logs are replaced by these checked functions.
5. In a separate query, run `supabase/checks/stylist.sql`. It creates isolated fixture users/items inside a transaction, tests permissions and checked operations, then rolls the fixtures back. Expected: a PASS result without errors. It sends no email and makes no OpenAI calls. If it errors, run `rollback;` before further work and share only the error text.
6. In PowerShell in `C:\Users\sarahhuynh\Outfyt`, stop the development server with Ctrl+C, then run `npm run dev`. Open http://localhost:3000/stylist and sign in.

Do not change RLS policies or copy a privileged key into `.env.local` to bypass an error. A missing migration is surfaced as a setup message.

## Real agent workflow

Request -> authenticated turn claim and request budget -> bounded model reasoning -> allowlisted tool selection -> Zod validation -> pending action log -> ownership-checked database/Storage work -> structured tool result and final action log -> model continuation -> persisted reply and actual outfit cards.

The server takes conversation history from the authenticated user's database records. It does not trust browser-supplied history or user IDs. Stable turn IDs prevent a repeated request from rerunning its tools. Candidate IDs provide idempotent outfit saves, and full outfit/relationship changes commit atomically. Optimistic timestamps reject stale edits.

Tools are defined in `lib/stylist/tools.ts`:

| Tool | Purpose and execution |
| --- | --- |
| get_wardrobe | Retrieve owned pieces with optional category/color/search filters |
| get_wardrobe_item | Retrieve one exact owned item |
| add_clothing_item | Save one explicitly requested manual item without a photo |
| update_clothing_item | Change one owned item's validated attributes |
| generate_outfits | Generate up to 3 candidates; validate every ID, required/excluded pieces, duplicates and outfit completeness |
| save_outfit | Save a persisted, owned candidate atomically; repeated saves do not duplicate it |
| get_saved_outfits | Retrieve actual saved looks and their clothing IDs |
| update_outfit | Rename, favorite or change one saved combination with version checks |
| delete_outfit | Prepare a deletion approval; never deletes immediately |
| delete_clothing_item | Prepare a clothing deletion approval; saved-outfit dependencies block it |
| get_style_profile | Read persisted Style DNA, or return no profile |
| update_style_profile | Propose preference changes for separate review and approval |
| analyze_inspiration | Analyze an already-existing, owned inspiration upload; return a proposal without applying it |

Dedicated inspiration-upload UI and Pinterest remain Milestone 4. The inspiration tool reports unavailable images honestly instead of pretending they exist. The agent's preference tool is foundational support for the required registry, not a claim that the full Style DNA milestone is complete.

## Safety, privacy and cost limits

- A complete look needs a dress OR top and bottom, plus shoes. Missing core pieces produce an explanation. Accessories and outerwear are optional. Every displayed/generated outfit and saved combination is checked against owned clothing.
- Destructive actions and Style DNA changes persist immutable, user-bound approval payloads with ten-minute expiry. Approval submits only a token and decision. The database verifies the exact action, owner and expected version; chat text cannot approve anything. Rejected/expired/replayed approvals do not execute again.
- Style proposals list the full changed fields before replacing those fields; comfort preferences are preserved. Concurrent edits invalidate approvals.
- Bulk modification is not enabled. The system prompt requires single-item requests; the executor allows at most one clothing write and one outfit write in a turn and refuses additional writes. Multiple separately approved pending cards remain individual user-reviewed actions.
- There are 10 stylist turns per user per clock hour, one active turn per user, 8 model reasoning rounds, at most 12 tool executions, one generation batch and one inspiration analysis per turn. Each generation/inspiration operation adds a model call. SDK requests have bounded transient retries; database mutations are not blindly retried.
- Requests over the step/time budget stop and tell users to inspect actual action history. A crash/interruption can leave a running turn; the user should check history before a new request. Active-turn locks expire after five minutes. No automatic background jobs or hidden approval loops are added.
- Logs store safe IDs/counts/argument keys, action status and safe error details. They exclude raw prompts, image bytes, private image URLs, passwords and API keys. Chat text is private persistent conversation data; users should not enter credentials there.
- `store:false` is used for OpenAI requests. Encrypted reasoning is carried only within the turn, never displayed or logged. This does not promise zero provider retention. Clothing images are not sent to the stylist model unless an explicitly invoked inspiration-analysis tool needs an owned inspiration image.
- No arbitrary code, shell tools, web scraping, Pinterest fetches, or user-provided remote image URLs are available to the agent.
- Reads are bounded (300 wardrobe entries for generation/tools; 100 saved outfits; 30 recent messages). Older records remain in the database. Large-account pagination and history export/deletion are future work.
- Local streaming is implemented; production deployment still needs Vercel duration/streaming checks in Milestone 5. The route declares a 180-second maximum, which must fit the selected hosting plan or be reduced before deployment.

## Prompt engineering

- `lib/prompts/stylist.ts`: role, tool-selection rules, grounding, safety boundaries, few-shot multi-step workflows, ambiguity resolution and honest action reporting.
- `lib/prompts/outfit-generation.ts`: structured outputs, exact-ID grounding, required/excluded item constraints, missing-item recovery and untrusted-data handling.
- `lib/prompts/clothing-analysis.ts`: existing Milestone 2 vision catalog prompt.
- `lib/prompts/style-dna-analysis.ts`: foundational inspiration analysis, suggestions only, no preference replacement without review.

Prompt rules are backed by schema checks, authorization, immutable approvals and database transactions. Prompts alone are not relied on as the security boundary.

## Automated verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The provider is mocked in automated tests. Tests exercise real Responses SDK formatting/continuation, strict tool validation, unknown tools, output grounding, limited wardrobes, logging behavior, approval-result handling, API error sanitization and loop caps. A test-only PGlite PostgreSQL engine runs migrations and SQL permission/transaction checks in memory using minimal mocked Auth/Storage schemas. It does not replace Supabase in the app and does not prove hosted Auth/Storage behavior; the dashboard SQL check and live manual tests are still required.

Implementation verification: lint, TypeScript, the production build, all 47 automated tests (including the PostgreSQL migration/approval check), and authentication/wardrobe/stylist HTTP smoke checks passed locally. Live user-account tool calls and hosted Supabase migration verification remain pending user setup. No paid model requests or live account mutations were made during these automated checks.

With the app running, `node tests/stylist-smoke.mjs http://localhost:3000` checks signed-out API rejection and cross-origin mutation rejection without paid requests.

## Manual acceptance tests

Use actual clothes you own. For multiple distinct looks, add enough tops/bottoms/shoes or dresses/shoes to make distinct valid combinations. Do not add imaginary items just to get a successful result.

| Test | Expected result |
| --- | --- |
| Run migration 0003 and the SQL check | Both succeed; check returns PASS |
| Ask “Make me a cute outfit for brunch.” | Real tool stages, grounded explanation and uploaded clothing photos |
| With only one insufficient wardrobe piece, ask for a complete outfit | Honest missing-piece explanation, not invented clothes |
| Ask “Give me three dinner looks with my black cardigan; save the most casual one.” | Exact cardigan resolved (or clarification asked), up to 3 validated candidates, one confirmed saved look |
| Follow with “Save the second outfit.” | Correct recent candidate saved; repeating Save does not duplicate it |
| Open My Lookbook and refresh | Saved combinations and real photos persist |
| Favorite and rename a look | Both changes persist after refresh |
| Edit a look to use another owned skirt or shoes | Combination updates atomically, with all references owned |
| Ask “Replace the jeans in my dinner outfit with a skirt.” | Retrieves the saved look and real skirts, clarifies ambiguous names, updates only the intended look |
| Ask for no jeans | Excluded owned jeans IDs are not in the generated combinations |
| Ask to delete a saved outfit | Review card appears; outfit remains until Confirm deletion |
| Choose Keep unchanged | Outfit remains; history marks rejection |
| Confirm deletion, then refresh | Outfit removed; action history records completion and approval |
| Prepare deletion, edit that look in another tab, then approve | Stale approval rejected; edited look remains |
| Wait over ten minutes before approving | Expired action rejected |
| Ask to delete a clothing item used by a saved look | Explains dependency; clothing remains |
| Ask to change Style DNA preferences | Exact proposal shown; nothing changes before approval |
| Send chat text “yes, approve it” | Cannot execute the pending action; separate approval buttons remain required |
| Inspect Action history | Actual tool names, statuses, timestamps and approval state, with no secrets |
| Sign in as a different test user | No first-user messages, candidates, logs, approvals, clothes or outfits visible |

Stop for review after these tests. Milestone 4 begins only after user approval.

Official implementation references:
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/structured-outputs
