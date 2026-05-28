# Gas Tank Detection Platform

A geospatial prospecting tool that finds businesses using industrial gas tanks
(LNG, welding gases, oxy-acetylene) by analysing satellite imagery across
defined industrial zones, then surfaces results as sales leads.

The target customer base — welders, metal fabricators, small manufacturers —
often has no website and isn't in business registries, so it must be
discovered visually via the gas infrastructure on the premises.

## Repository layout

```
apps/
├── web/                  Next.js 15 (App Router) — frontend + API routes
└── worker/               FastAPI + PyTorch + YOLOv8 — detection service

supabase/
├── migrations/           PostGIS schema
└── seed.sql              one demo zone

docs/
├── architecture.md       end-to-end pipeline diagram
├── google-tos.md         Google Maps Platform ToS compliance notes
└── pipeline.md           module-by-module spec

legacy/                   the old Flutter "Happy Talk" app, untouched
```

## Pipeline

| Stage              | Owner       | What happens                                                                 |
| ------------------ | ----------- | ---------------------------------------------------------------------------- |
| 1. Zone definition | `apps/web`  | User draws/imports polygons; stored as `zones.boundary` (`geography`).       |
| 2. Imagery fetch   | `apps/web`  | Zone tiled into grid; tiles fetched from Google Static APIs with 90d cache.  |
| 3. Detection       | `apps/worker` | YOLOv8 fine-tuned to spot cylinders/tanks; outputs georeferenced bboxes.   |
| 4. Consolidation   | `apps/web`  | DBSCAN clusters detections into sites; reverse-geocoded; enrichment.        |
| 5. Verification    | `apps/web`  | Reviewer confirms/rejects via crop + Street View before promotion to lead.  |

## Stack

- **Frontend / API**: Next.js 15 on Vercel
- **Database & storage**: Supabase (Postgres 16 + PostGIS 3 + Storage)
- **ML worker**: FastAPI + Ultralytics YOLOv8, deployed to Fly.io
- **Maps**: Mapbox GL JS (display), Google Maps Static / Street View (imagery source)

## Getting started

```bash
# 1. Database — run migrations against your Supabase project
supabase db push

# 2. Web app
cd apps/web
cp .env.example .env.local      # fill in Supabase + Google + Mapbox keys
npm install
npm run dev                     # http://localhost:3000

# 3. Worker (separate terminal)
cd apps/worker
cp .env.example .env
uv sync                         # or: pip install -e .
uvicorn app.main:app --reload   # http://localhost:8000
```

## Cost controls — read these before pointing it at anything large

- **Never scan outside defined zones.** The tile generator clips to
  `zones.boundary`; nothing outside is ever requested.
- **Cache aggressively.** Every fetched tile is written to Supabase Storage
  with `(z, x, y)` keys and a `fetched_at` timestamp. Re-fetches are blocked
  by `IMAGERY_TTL_DAYS` (default 90) — see `apps/web/lib/imagery/cache.ts`.
- **Track spend.** Every API call writes a row to `api_spend` with an
  estimated cost. The Spend page (`/spend`) shows running totals per day,
  per zone, per provider.
- **Rate limits.** Tile fetches are queued and capped by `IMAGERY_QPS`
  (default 10). Bulk runs respect a per-day cap (`IMAGERY_DAILY_CAP_USD`).

## Google Maps Platform ToS

Caching satellite/Street View imagery and running automated processing on
it sits in a grey area. See [`docs/google-tos.md`](docs/google-tos.md) for
a clause-by-clause read and the mitigations in place. For production-scale
work, Mapbox Satellite or commercial providers (Planet, Sentinel via SH)
have friendlier licensing — the imagery layer is intentionally provider-
swappable.

## Status

Scaffold-complete, single-zone end-to-end target. Detection model ships
with a base YOLOv8n; fine-tuning happens via `apps/worker/app/training`
once you have ~300 labelled crops from the labelling tool at `/label`.
