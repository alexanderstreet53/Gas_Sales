# Pipeline detail

## 1. Zone definition

**Where**: `app/zones`, `components/ZoneDrawer.tsx`, `app/api/zones/route.ts`.

User draws a polygon (Mapbox click-to-add-corner) or POSTs GeoJSON to
`/api/zones`. Persisted to `zones.boundary` as `geography(Polygon, 4326)`.
A zone in status `draft` is never swept; the user explicitly transitions
to `active`.

## 2. Imagery acquisition

**Where**: `lib/geo/tiles.ts`, `lib/imagery/google.ts`, `lib/imagery/cache.ts`,
`lib/imagery/queue.ts`, `app/api/zones/[id]/fetch/route.ts`.

1. Tile the zone's polygon into 640×640 cells at the zone's `zoom`
   (default 19). Cells whose **centre** is outside the polygon are dropped
   — we never request imagery outside the user's zone.
2. For each cell, compute a stable `cache_key` from
   `(provider, kind, lat, lng, z, w, h, scale)`.
3. If `imagery_tiles` has a row with that key and `expires_at > now()`,
   return a fresh signed URL. Log a `cache_hit=true` row in `api_spend`.
4. Else, hit the Google Static Maps API, upload to Storage, insert the
   row, log a `cache_hit=false` row.
5. **Budget cap**: before any non-cached call, sum `api_spend` over the
   last 24h. If ≥ `IMAGERY_DAILY_CAP_USD`, fail closed with a 5xx.
6. **Rate limit**: `p-limit(IMAGERY_QPS)` caps concurrent fetches.

Sweeps are *chunked* (default 200 tiles/chunk) to fit serverless time
budgets. The endpoint returns `stoppedReason: "chunk_limit"` to indicate
the caller should re-invoke.

## 3. Detection

**Where**: `apps/worker/app/detection/yolo.py`, `apps/worker/app/main.py`,
`apps/web/app/api/detect/route.ts`, `lib/worker.ts`.

The web layer fetches a tile row, signs the storage URL, and POSTs to
`worker/detect`. The worker:

1. Downloads the image via the signed URL.
2. Runs YOLOv8 (fine-tuned weights if present, else `yolov8n.pt`).
3. Returns boxes in tile-pixel coords + per-box (lat, lng) computed
   via the inverse Web Mercator transform.

The web layer writes one row per box to `detections`, georeferenced.

## 4. Consolidation

**Where**: `lib/geo/clustering.ts`, `app/api/zones/[id]/consolidate/route.ts`.

Pull all `confirmed` detections in the zone, DBSCAN at ε=25m, write one
`sites` row per cluster, reverse-geocode the centroid, and insert one
`leads` row per site (status=`new`).

## 5. Verification

**Where**: `app/review`, `components/ReviewQueue.tsx`,
`app/api/detections/[id]/review/route.ts`.

Sorted-by-confidence queue of unreviewed detections. Reviewer sees the
crop with the box overlaid; clicking **Confirm** sets
`review_result='confirmed'`, **Reject** sets it to `'rejected'`. Only
confirmed detections feed clustering.

## Failure modes worth knowing

| Failure                                              | What happens                                                |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY` missing                        | `fetchSatelliteTile` throws on first non-cached call.       |
| Daily spend cap hit mid-sweep                        | Sweep returns `stoppedReason='budget_cap'`. Bump cap or wait. |
| Worker offline                                       | `/api/detect` throws 5xx; no detection rows written.        |
| PostGIS geometry not returned as GeoJSON             | `/api/zones/.../fetch` returns 500 with a hint to enable    |
|                                                      | GeoJSON output in Supabase (Settings → API → use GeoJSON).  |
