# Outfyt class demo: 1–2 minutes

## Prepare before presenting

- Apply migrations 0001–0006 and run the read-only release check. Verify the actual local/production service configuration before class.
- Use one account you control, ideally a dedicated demo account. Add photos below 4 MB of actual owned garments: at least two tops, two bottoms and shoes (or two dresses plus shoes). An optional starting template is `demo/wardrobe.template.json`; it is manual setup, never an automatic database seed.
- Save a simple Style DNA profile with colors, comfort and notes. Optional inspiration/Unsplash examples can be prepared in advance; do not show them as owned clothes.
- Confirm your model/key/budget works. Live calls have variable latency and cost; do one rehearsal rather than repeatedly exhausting hourly limits. Clear old pending approvals and use a fresh chat.
- Open Closet, Stylist and Lookbook tabs. Keep private keys, environment files, confirmation links, dashboard tokens and other users' data off screen.

## Presentation sequence

1. **Own clothes and style (10 seconds).** Show the actual wardrobe and briefly show the saved Style DNA summary. Explain that outfit IDs must belong to this account.
2. **Real multi-step action (30–45 seconds).** Ask: `Make me two casual brunch outfits from my closet, follow my Style DNA, and save the first one.` Expected: real tool stages, up to two validated cards with uploaded garment photos, one confirmed save and a Saved button. If the closet is insufficient, show the honest missing-piece response.
3. **Persistence (10 seconds).** Refresh Lookbook. Show the saved outfit; favorite it if useful.
4. **Conversational modification (20 seconds).** Ask: `Rename the outfit you just saved to Campus brunch.` Expected: get_saved_outfits, exact look identification, update_outfit, confirmed result. Refresh Lookbook to show the actual new name.
5. **Safety (15–20 seconds).** Ask: `Delete Campus brunch.` Show that the record remains while approval is pending. Choose **Keep unchanged** to demonstrate rejection without removing your demo data.
6. **Explain execution (10 seconds).** Open Action history. Point to tool names, statuses and approval state. Mention strict schemas, retrieved-fact grounding, owner checks and tool results returned to the model.

## Optional alternate moments

- For visual recommendations, ask for bottoms with image examples. Explain that credited stock references are not items in the closet or shopping listings.
- For Style DNA, show the guided steps, skip optional inspiration, review the exact fields and approve a small change. For a vision-focused demo, prepare a permitted inspiration upload and analyze it; suggestions still require review before applying.
- At mobile width, open navigation and close with Escape to show a usable responsive interface.

## If the service fails during class

Show the actual error and action history. Do not claim a save or edit succeeded until the database confirms it. Use an existing saved look to explain persistence and a pretested approval flow. If email delivery is restricted, use your already-confirmed demo account rather than consuming the sender's quota on stage.

Automated tests mock providers; the demonstrated agent uses real configured OpenAI and Supabase operations. No fake recommendations or hidden seed records are substituted for a failed live action.
