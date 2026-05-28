# Google Maps Platform — ToS posture

The Google Maps Platform Terms of Service include clauses that constrain
how we may use the Static Maps and Street View APIs. Read these alongside
the live ToS at <https://cloud.google.com/maps-platform/terms>.

## Clauses that bite

**§3.2.3 "No Caching or Storage."** You may not pre-fetch, cache, index,
or store any Content except to the limited extent expressly permitted in
the Service Specific Terms. The Service Specific Terms allow temporary
caching of address/place IDs and similar metadata for up to 30 days; they
**do not** clearly extend that licence to satellite or Street View
*imagery* itself.

**§3.2.4 "No automated determination of identity / use in CRM-like
products."** Some of what this platform does — surfacing prospects, then
attaching addresses and place IDs to them — could be construed as building
a derivative database that competes with Places.

**§10.5 "No machine-learning training on Content."** The ToS prohibit
using Maps Content as input to ML model training.

## What this project does and how it lines up

| Action                                                  | Posture                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| Cache Static Maps and Street View images for 90 days    | **Grey/at risk.** We treat this as "limited operational cache" but the safe reading is that Google does not permit it. |
| Run YOLO inference on cached tiles                      | **Grey.** Not training the model on the imagery — only inference. Still, "automated determination" language is broad. |
| Fine-tune YOLO on hand-labelled crops from those tiles  | **Likely violates §10.5.** Don't ship fine-tuned weights to production until this is resolved. |
| Reverse-geocode + Places enrichment, store place_id     | **Permitted** if cached ≤ 30 days; we store indefinitely → trim. |

## Mitigations in code

- Imagery cache lives in **Supabase Storage**, not exposed publicly. Signed
  URLs only, 1-hour expiry. This is *technically* still storage, but it's
  not redistribution.
- `IMAGERY_TTL_DAYS` defaults to 90 but is configurable — set lower or use
  a provider with friendlier licensing.
- The imagery layer is intentionally one file
  (`apps/web/lib/imagery/google.ts`) so it can be swapped for Mapbox
  Satellite, Sentinel-2 via Sentinel Hub, or Planet without touching
  callers.
- The labelling / training pipelines are isolated under
  `apps/worker/app/training/` and feature-flag-able — don't run them on
  Google imagery in production.

## Recommended path before scaling

1. **Switch the imagery provider** to a commercial satellite source or
   Mapbox Satellite. Both have licences that allow caching and processing.
2. Keep Street View for *manual verification only* (one image, viewed by
   a human, never re-fetched).
3. Continue using Google for **geocoding and Places** (cache-permitted
   metadata, not pixels).

Treat the Google-backed pipeline as a development convenience, not a
shippable production posture.
