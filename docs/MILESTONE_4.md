# Milestone 4: Style DNA

## What is implemented

The Style DNA page guides new users through four steps, showing one panel at a time: Your aesthetic, Everyday details, optional Inspiration, then Review & save. A progress indicator and Back controls preserve the draft between steps. Dark purple buttons identify the primary action. Returning users see a compact saved profile with an Edit my Style DNA action instead of repeating onboarding.

Preferences include multiple aesthetics and custom choices, preferred colors, favorite clothing types, disliked styles, comfort preferences, a style summary, and styling notes. Changes go through an exact persisted review card before approval saves them. Rejecting keeps the saved profile unchanged and returns to draft review. A stale editor cannot silently overwrite a newer profile. Pending reviews resume after refresh. Editing a field clears the locally selected review so an earlier proposal cannot be mistaken for the newly edited draft.

The inspiration gallery supports private JPEG/PNG/WebP uploads, a local preview, names, selection of up to five images for one combined vision analysis, and confirmed removal. Results are suggestions only. Add suggestions & continue preserves existing selections, dislikes, comfort preferences, notes, and a non-empty summary; it adds available new choices without exceeding field limits. You can edit the resulting draft before reviewing and approving it. An empty summary can be filled from the analysis. You can also replace the summary yourself after reviewing the suggested text.

Saved Style DNA, including comfort and notes, is passed into subsequent outfit generation. The chat can retrieve your inspiration image IDs/names and analyze one selected owned upload, using the same analysis cache and budget as the page. Analysis never adds wardrobe clothes or creates outfits from inspiration photos.

Pinterest is optional and reference-only: saving a full board URL does not connect Pinterest, retrieve Pins, synchronize a board, or analyze it. The page says synchronization is not configured. Existing Unsplash recommendations remain connected. No new external account or Pinterest credentials are required for this milestone.

## Setup: one database update

Use the existing Supabase project and OpenAI configuration. Do not replace `.env.local` or paste any credentials into chat.

1. Open https://supabase.com/dashboard in your browser and choose your **outfyt** project.
2. In the left sidebar, open **SQL Editor**. Create a **New query** (dashboard wording may vary).
3. In your project editor, open `supabase/migrations/0006_style_dna.sql`.
4. Copy the entire file into the new SQL query. Run it **once, after migrations 0001 through 0005**. Do not rerun older migrations.
5. Expected result: SQL succeeds without errors. The migration adds `style_profiles.notes`, `inspiration_images.name`, analysis/deletion tables, private owner policies, checked functions, and extended approval handling. Existing clothes, profiles, chats, and looks remain.
6. Create a separate query. Copy all of `supabase/checks/style-dna.sql` and run it.
7. Expected result: `PASS: Style DNA approvals, comfort/notes, uploads, cache, budgets, deletion, references and cross-user isolation`. The fixtures roll back; no email, paid AI requests, or changes to your actual profile are made by this SQL check.
8. If either step fails, share only the error text. If the check leaves an aborted transaction, run `rollback;` before another query. Do not remove RLS or add a service-role key to work around it. A duplicate-function/column error can mean the migration already ran; inspect that before rerunning.
9. Open the PowerShell terminal for `C:\Users\sarahhuynh\Outfyt`. If the dev server is running, press **Ctrl+C** there.
10. Run:

```powershell
npm run dev
```

11. Open http://localhost:3000/style-dna and sign in. Expected: the first guided step for a new profile, a saved summary for an existing profile, or the final review if an approval is pending. No database-setup error should appear.

The guided-flow UI update needs no additional migration or environment change. If 0006 is already applied, refresh the page; do not run it again.

The private `inspiration-images` bucket was created by migration 0001 and should already exist in **Storage**. If uploads fail, verify that bucket exists, is private, and allows JPEG/PNG/WebP up to 10 MB. The existing owner-folder policies must remain enabled. Do not make the bucket public.

## How to use it

1. **Your aesthetic:** choose tags or custom comma-separated values, then **Continue to everyday details**. Lists permit up to 12 choices of 40 characters each. Choices can be left open while exploring.
2. **Everyday details:** enter preferred colors, clothing types, dislikes and comfort preferences, then **Continue to inspiration**. Back preserves the draft.
3. **Inspiration (optional):** choose **Add inspiration photos** or **Skip for now**. Skipping goes to review without an AI request.
4. If adding inspiration, click **Choose a photo**, inspect its preview/name, then **Upload photo**. The gallery appears as photos are uploaded. Existing inspiration remains available here when editing.
5. Select one to five photos and click **Analyze ... photos**. Progress appears while the owned photos are sent to OpenAI using your API allowance. Suggestions appear only after analysis succeeds.
6. Choose **Add suggestions & continue** to merge ideas into the draft and open review, or **Continue without suggestions** to keep your choices. Existing choices, dislikes, comfort, notes and non-empty summary are preserved. You can return to photos or continue without analysis.
7. **Review & save:** inspect the draft summary. Optional summary/notes fields are behind **Add a summary or styling notes**. To change earlier fields, use **Back to edit preferences** or an unlocked progress step.
8. Click **Review changes to save**. This creates an exact persisted review card, not a saved preference change.
9. Inspect the proposed fields, then **Approve changes** to save or **Keep unchanged** to return to draft review. Approvals expire after ten minutes. Navigation locks while approval is in progress. Saving shows a compact summary and **Create a look with my style**.
10. Returning users can **Edit my Style DNA** without re-entering saved data. Pending reviews resume at Review & save after refresh; Continue does not persist unfinished form edits.
11. **More options → Reload saved progress** refreshes previews and restores the saved profile or pending review, resetting unsaved edits. Ordinary upload/analysis updates preserve the draft.
12. To remove a photo, use **Remove**, then **Confirm removal** or **Keep image**. Resolve that confirmation before leaving the step. Removal keeps saved preferences; cleanup warnings provide **Retry cleanup**.
13. After saving, **More options** contains the optional Pinterest bookmark form. Use a full `https://www.pinterest.com/username/board-name/` URL. No synchronization or Pin analysis occurs.

## Acceptance tests

| Action | Expected result |
| --- | --- |
| Run migration 0006 and style-dna.sql | Success and PASS |
| Open Style DNA without a saved profile | Only the first step appears; gallery, notes and Pinterest form are hidden |
| Continue through steps, then go Back | Content appears at its step; entries remain |
| Skip inspiration | Review opens with no upload or AI request required |
| Upload a photo and analyze selected photos | Preview/upload precedes analysis; results appear only after success |
| Save successfully or reopen an existing profile | Compact saved summary and edit action |
| Refresh with a pending review, then edit an earlier field | Review resumes; editing requires a fresh review before saving the changed draft |
| Select two aesthetics and enter colors, clothing types, dislikes, comfort and notes | All fields editable; custom choices supported |
| Click Review changes to save, then refresh without approving | Review persists; saved profile has not changed |
| Choose Keep unchanged | Proposal rejected; saved preferences remain |
| Review again, approve, then refresh | All approved fields persist, including comfort and notes |
| Prepare a proposal, change/save the profile in another tab, then approve the old proposal | Stale approval rejected; newer saved preferences remain |
| Leave an editor open, save from another tab, then try reviewing from the old editor | Conflict message asks you to load saved preferences; no silent overwrite |
| Upload 2–3 fashion inspiration images | Private gallery previews persist after refresh; closet remains unchanged |
| Try unsupported SVG/HEIC or an image over 10 MB | Helpful validation; invalid upload not saved |
| Select several photos and analyze | Spinner, then structured shared-style suggestions; saved profile unchanged |
| Analyze the same selection again, including a different selection order | Cached result; message says no new AI request needed |
| Add suggestions & continue | Existing choices, dislikes, notes, comfort and non-empty summary preserved; review opens and choices remain editable through Back |
| Edit the merged draft, review and approve | Only the reviewed final fields persist |
| Analyze an image without fashion content | Honest error instead of fabricated style suggestions |
| Remove an image, cancel, then remove and confirm | Cancel keeps it; confirm removes it without erasing saved preferences |
| Save a Pinterest board URL and refresh | Bookmark persists; sync not configured, last synchronized never |
| Enter an arbitrary website or individual Pin URL | Rejected by the board URL field |
| Ask AI Stylist for an outfit following your saved Style DNA | Uses real owned clothing and saved preferences; existing saves still work |
| Sign in with another test account | No first-account profile, images, analyses, pending approvals or board bookmarks visible |

Manual profiles, uploads, and bookmarks do not require an AI call. If OpenAI access is unavailable or the analysis quota is reached, manual editing still works. Avoid repeatedly running paid analyses merely to test limits; the database harness verifies them without live requests.

## Implementation, limits and verification

- `lib/style/`: shared schemas, safe upload persistence, structured multi-image analysis, private reads and errors.
- `app/api/style-dna/`: profile review, upload, analysis, persisted image deletion, Pinterest bookmark.
- `components/style/editor.tsx`: actual preferences/gallery/analysis/review UI.
- `0006_style_dna.sql`: additive migration; preserves the prior agent approval checks while extending approved comfort/notes edits. Old agent proposals preserve those fields.
- Up to 50 owned inspiration images, 10 MB each; up to five per analysis; 10 new analyses/user/clock hour, shared by chat and page. Failed attempts consume the budget. Completed analyses for the same image IDs are reused independent of order. Uploads are immutable through the UI; no arbitrary remote URLs are fetched.
- Analysis records never update the profile. Private image IDs and paths are server-checked before downloading. Deletion invalidates analyses containing that image. Signed previews expire after ten minutes; More options → Reload saved progress refreshes them.
- Structured output validates fashion relevance and suggested fields. Embedded text is untrusted input, not executable instructions. Vision can be imperfect; review remains required.
- Development tests mock OpenAI; embedded PostgreSQL executes the migrations and policies. Hosted Auth/Storage and real fashion-photo analysis require the manual checks above.

Run lint, typecheck, tests and build using the commands in README. Optional signed-out/cross-origin checks: `node tests/stylist-smoke.mjs http://localhost:3000` with a local server running.

Suggested commit message: `Add Style DNA preferences and inspiration analysis`.

Guided-flow follow-up commit: `Guide users through Style DNA setup`. This UI change passed the existing 65 tests, lint, type checking and production build. The browser interaction checklist above still needs user acceptance.

Stop here for user review. Milestone 5 (finalization and deployment) starts only after approval.

Official references used for the image-analysis implementation:
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs
