# Free reference-photo account setup

Checked November 6, 2026. Pexels currently says new API key issuance is paused, so new users should use Unsplash's free Demo API instead. If you already have an active Pexels key, tell us without sharing its value before setting up another account.

The photo-search tool and recommendation cards are implemented. After adding the key, apply `supabase/migrations/0005_reference_photos.sql` once in Supabase SQL Editor (after migrations 0001 through 0004), run `supabase/checks/photos.sql`, and restart `npm run dev`. The SQL check rolls back its fixtures and makes no API requests. Existing messages and saved looks are preserved.

## Steps

1. Open https://unsplash.com/join and create a free account, or sign in to an existing one. Complete any email verification requested by Unsplash.
2. Open https://unsplash.com/oauth/applications (also linked as Your apps from https://unsplash.com/documentation).
3. Select New Application. Read and acknowledge the API guidelines if prompted.
4. Name the application `Outfyt`. Use this description: `A college personal styling app that shows credited clothing reference photos alongside AI recommendations.`
5. Leave the app in Demo mode. Official documentation describes a free allowance of 50 JSON API requests per hour. Production access is a separate review for a public release; no production approval is needed just for this local educational setup.
6. Open the application's Keys section and copy the Access Key. The photo-search integration will use public search authentication; it does not need the Secret Key, user OAuth tokens or Pinterest access.
7. In `C:\Users\sarahhuynh\Outfyt\.env.local`, keep existing values and add:

```dotenv
UNSPLASH_ACCESS_KEY=YOUR_ACCESS_KEY
```

8. Do not paste the key in chat or commit `.env.local`. Restart `npm run dev` after editing it. Tell the assistant `Unsplash key ready`; do not send its value.

Exact dashboard layout can change. If a label differs or registration is unavailable, describe the options/error text instead of changing to a paid plan.

## Successful setup

| Test | Expected result |
| --- | --- |
| Reopen Your apps | `Outfyt` exists in Demo mode |
| Open Keys | An Access Key is available |
| Check `.env.local` locally | `UNSPLASH_ACCESS_KEY` has a non-empty value |
| Run `git check-ignore .env.local` in the project terminal | Prints `.env.local` |

## Try the integration

1. Ask the stylist: `Recommend only bottoms for a laid-back fall tomboy look in blue, white and green. Show image examples.`
2. Expect a searching status followed by up to three credited photo cards below the reply. The label says `Style inspiration — not in your closet`. Stock results may differ from the requested colors or garments; these are not verified product matches.
3. Click the photographer credit and photo: each opens the relevant Unsplash page. An image load failure offers a link instead of a broken image.
4. Refresh or switch to a new chat and return: the photo references remain in their original conversation. Refreshing/history navigation does not run another search.
5. Check the closet and lookbook: reference photos have not been added. Existing save buttons still work for actual owned outfit candidates.
6. Ask for an outfit made only from owned clothes: existing closet-photo cards still work, without an unnecessary reference search.
7. Optional: temporarily remove the Unsplash key locally and restart. A request for image examples explains unavailability and can still return written advice. Restore the key and restart afterward.

## Search limits and persistence

The server allows one search (up to three photos) per stylist request and reserves at most 45 searches across the project in a rolling hour. This leaves headroom within Demo's 50-request allowance, but cannot account for requests made by other applications sharing the key. Existing 10 stylist requests/user/hour also applies. Reservations count failed requests and repeated tool calls cannot retry within the same turn. Empty results, invalid keys, timeouts and provider quota failures return honest errors without exposing provider responses or credentials. Only the short garment/style query is sent to Unsplash; the model is instructed not to include private personal details.

Photo URLs and credits are stored against the owning turn under row-level security. The UI uses only validated HTTPS Unsplash image and attribution URLs, directly hotlinks the provider's image URLs, and adds referral parameters to credit links. No image is imported or downloaded into user storage. Displaying old references makes no new search API request, although the browser still loads the hotlinked image.

## Reference-photo behavior

- Show real reference photos only, labeled `Style inspiration — not in your closet`.
- Credit the photographer and Unsplash with appropriate links.
- Use the API-provided hotlinked `photo.urls` image URLs.
- Reference/search-result display is not a download. If a future feature imports/selects an image for another purpose, implement the required download-event tracking before enabling that feature.
- Do not represent stock photos as exact shopping listings, guaranteed color matches, verified products for sale, or clothes the user owns.
- Keep requests bounded and handle quota/authorization failures honestly. The free image-search allowance does not remove existing OpenAI text-analysis costs.

Sources:
- https://help.pexels.com/hc/en-us/articles/900004904026-How-do-I-get-an-API-key
- https://unsplash.com/documentation
- https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit
