# Outfyt class demo: 1–2 minutes

Live site: https://outfyt-dun.vercel.app/

Verified November 10, 2026: the live home page has one Start styling link, no removed navigation labels, and three clothing images. All four signed-out smoke scripts passed against this site, covering public/login pages, protected routes, API authentication, cross-origin rejection, 404s and release headers. This does not verify a signed-in account, email delivery, real AI calls or persisted account data.

## Finish before recording

1. If not already configured, in Vercel project Settings → Environment Variables, set Production `NEXT_PUBLIC_APP_URL` to `https://outfyt-dun.vercel.app`. Do not use localhost.
2. In Supabase → Authentication → URL Configuration, confirm Site URL is `https://outfyt-dun.vercel.app` and Redirect URLs include `https://outfyt-dun.vercel.app/auth/callback` and `https://outfyt-dun.vercel.app/auth/confirm`. Keep local-development URLs if needed. Save. Redeploy in Vercel if an environment value changed.
3. On the live site, test a normal sign-in/refresh/sign-out. Outside the recording, verify confirmation redirects once with an allowed test email if not already done. Never show confirmation tokens or credentials in the video. Existing confirmed accounts can be used for the demo without signing up again.
4. Use the live site to upload/analyze a real photo, approve/save Style DNA, generate/save/rename a look, and refresh Lookbook. Reject a deletion and verify the record remains. A second test account should see none of the first account's data. If one fails, fix it before recording rather than claiming completion.
5. Check the course's actual video length, submission format and link-access requirements. The outline below targets about two minutes of demonstration; response latency may extend a continuous take. If editing is permitted, trim dead waiting time while preserving actual requests, stages and results. Do not substitute fake responses or present earlier results as a new successful operation.

The full setup, read-only database release check and troubleshooting remain in `docs/DEPLOYMENT.md`. Do not rerun migrations simply to prepare a video.

## Prepare before presenting

- Apply migrations 0001–0006 and run the read-only release check. Verify the actual local/production service configuration before class.
- Use one account you control, ideally a dedicated demo account. Add photos below 4 MB of actual owned garments for two complete combinations (for example, two tops, a bottom and shoes; or two dresses and shoes). An optional starting template is `demo/wardrobe.template.json`; it is manual setup, never an automatic database seed.
- Save a simple Style DNA profile with colors, comfort and notes. Optional inspiration/Unsplash examples can be prepared in advance; do not show them as owned clothes.
- Confirm your model/key/budget works. Live calls have variable latency and cost; do one rehearsal rather than repeatedly exhausting hourly limits. Clear old pending approvals and use a fresh chat.
- Open Closet, Stylist and Lookbook tabs. Keep private keys, environment files, confirmation links, dashboard tokens and other users' data off screen.
- Ensure the saved-look name `Campus brunch` is not already shared by several outfits. Use a fresh unique name if needed so the rename/delete requests have an unambiguous target.

## Word-for-word narration and screen actions

Timing is a target, not a guarantee about provider response speed. Start already signed in, then open the public home page so Start styling enters the dashboard without a login interruption.

| Approximate time | Show/do | Say |
| --- | --- | --- |
| 0:00–0:10 | Home page with clothing collage; click Start styling | “This is Outfyt, an AI personal styling app that turns clothes you already own into outfits that match your style.” |
| 0:10–0:20 | My Closet grid; briefly open an item's editable details | “My closet stores real clothing photos with editable categories, colors, and style tags. These records ground the recommendations.” |
| 0:20–0:30 | Style DNA saved summary | “Style DNA saves my preferred aesthetics, colors, and comfort needs. Inspiration is optional, and proposed changes need my approval.” |
| 0:30–1:00 | AI Stylist → New chat; send prompt 1 below; keep real stages visible and wait for actual saved result | “I can ask the agent to create and save a look in one request. It retrieves my wardrobe and preferences, validates the combinations, and saves the selected outfit.” |
| 1:00–1:15 | Point to Saved; open Lookbook and refresh | “The Saved button confirms the database operation. The outfit remains in my lookbook after I refresh.” |
| 1:15–1:30 | Return to the same chat; send prompt 2; show the actual changed name in Lookbook | “The agent can modify saved records too. Here I’m renaming this look through conversation.” |
| 1:30–1:50 | Send prompt 3; show the pending approval; choose Keep unchanged; verify look remains | “Deleting is different: the outfit stays until I approve. I’ll choose Keep unchanged to show that rejecting the request preserves it.” |
| 1:50–2:00 | Expand Action history in that chat; show completed save/update and rejected deletion | “Action history shows what the agent actually executed. OpenAI interprets the request, validated tools perform the work, and Supabase stores the results.” |

### Prompts to copy

Prompt 1:

```text
Create two casual brunch outfits using only my closet and my Style DNA. Save the first outfit.
```

Prompt 2, in the same conversation:

```text
Rename the outfit you just saved to Campus brunch.
```

Prompt 3, after the rename is confirmed:

```text
Delete Campus brunch.
```

Then click **Keep unchanged** on the actual approval card. Do not say the look was deleted. If the agent asks a clarification, answer it using the visible real record; do not assume a target or invent an ID. If there are insufficient clothes for two distinct complete looks, add actual owned pieces before the demo or request just one and narrate the limitation honestly.

### Optional extra clips if the assignment allows more time

- **Real clothing recognition:** open Add to closet, choose a permitted photo below 4 MB, click Analyze photo, show its spinner and editable results. Correct an attribute before saving a genuinely new piece; cancel if the garment is already in the closet to avoid duplicate demo entries.
- **Style DNA review:** show a small preference edit through the guided steps, skip optional inspiration, review the exact fields and approve. For a vision-focused clip, analyze an owned inspiration upload and edit its suggestions before approval.
- **Reference photos:** ask for bottoms with image examples and point out photographer credits. Explain that stock references are inspiration, not owned garments or verified shopping listings.
- **Technical explanation:** briefly show `lib/prompts/stylist.ts`, `lib/stylist/tools.ts` and `lib/stylist/loop.ts` if required by the rubric. Explain grounding, strict schemas and passing real tool results back to the model. Do not open `.env.local` or provider credential dashboards.

Do not demonstrate Pinterest as connected: it is currently a reference bookmark feature, not authorized board synchronization.

## If the service fails during class

Show the actual error and action history. Do not claim a save or edit succeeded until the database confirms it. Use an existing saved look to explain persistence and a pretested approval flow. If email delivery is restricted, use your already-confirmed demo account rather than consuming the sender's quota on stage.

Automated tests mock providers; the demonstrated agent uses real configured OpenAI and Supabase operations. No fake recommendations or hidden seed records are substituted for a failed live action.
