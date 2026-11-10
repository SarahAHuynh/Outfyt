# Landing-page photography

The public landing page uses three fixed Unsplash photo URLs selected on November 10, 2026. It does not search at render time, require a visitor's account, expose a key, or display private wardrobe images. Two one-time search requests were used to select the assets during development; future page visits load the images directly from Unsplash's CDN.

| Placement | Photographer | Source photo |
| --- | --- | --- |
| Main outfit flat lay | Zoe | https://unsplash.com/photos/brown-leather-shoes-beside-brown-leather-belt-NKjIT7u5nXE |
| Neutral clothing rail | Alyssa Strohmann | https://unsplash.com/photos/hanged-top-on-brown-and-white-clothes-horse-TS--uNw-JqE |
| White knitwear | Shelter | https://unsplash.com/photos/white-knit-sweater-on-white-wooden-surface-xEraWP_ZRGU |

API-provided image URLs and their `ixid` tracking parameters are retained in `app/page.tsx`. Next Image uses `unoptimized` so the browser hotlinks the provider image directly; the primary image is preloaded. Photographer profile links and Unsplash attribution have referral parameters and appear below the collage. The source URL slugs/old API alt text may not describe every visible item; image alt text in the page is based on actual inspection.

The collage is public inspiration, not an outfit generated for the visitor or clothes claimed to be in their closet. Images remain subject to external CDN availability. No image-import or download feature was added.

Reference: https://unsplash.com/documentation#hotlinking

Manual acceptance: one Start styling CTA leads into the authenticated studio; Open studio and the two former navigation links are absent; all three photos/credits load; the collage fits narrow mobile widths without clipping the button or causing horizontal scrolling.
