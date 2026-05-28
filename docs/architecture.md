# Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Vercel (Next.js 15)                                                     │
│                                                                          │
│  /  /zones  /leads  /review  /label  /spend          ← UI                │
│        │       │       │       │       │                                 │
│        ▼       ▼       ▼       ▼       ▼                                 │
│  ┌──────────── api routes (App Router) ─────────────────────────────┐    │
│  │  /api/zones                                                       │    │
│  │  /api/zones/[id]/fetch         ─► imagery cache + Google APIs    │    │
│  │  /api/zones/[id]/consolidate   ─► DBSCAN clusters → leads        │    │
│  │  /api/imagery/{tile,streetview}                                  │    │
│  │  /api/detect                    ─► worker /detect                │    │
│  │  /api/labels                                                     │    │
│  │  /api/detections/[id]/review                                     │    │
│  │  /api/leads/[id]                                                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
         │                                                       │
         │ SQL + Storage                                  HTTPS  │ (X-API-Key)
         ▼                                                       ▼
┌────────────────────────────┐                ┌─────────────────────────────────┐
│ Supabase                   │                │ Fly.io worker (FastAPI)         │
│                            │                │                                 │
│  Postgres + PostGIS        │                │  YOLOv8 (Ultralytics)           │
│   ├─ zones                 │                │  /detect /detect/batch /healthz │
│   ├─ imagery_tiles         │                │                                 │
│   ├─ detections            │                │  Training entrypoints under     │
│   ├─ sites                 │                │  app/training/                  │
│   ├─ leads                 │                │                                 │
│   ├─ training_labels       │                │  Reads cached tile via signed   │
│   └─ api_spend             │                │  URL — no direct DB access.     │
│                            │                └─────────────────────────────────┘
│  Storage bucket: imagery   │
│  90d-cached tile blobs     │
└────────────────────────────┘
```

## Trust boundary

The worker is the only component with model weights. It never talks to
Supabase directly — the web layer hands it a signed URL, gets back boxes,
and writes them. This keeps the worker stateless and easy to redeploy.

## Why this layout fits Vercel

| Pain                           | Mitigation                                                   |
| ------------------------------ | ------------------------------------------------------------ |
| Heavy ML deps blow function    | Worker runs out-of-band on Fly; Vercel just calls it.        |
| No persistent disk             | Tile blobs in Supabase Storage; rows in Postgres.            |
| 60s function timeout (Hobby)   | Sweeps are chunked — call `/api/zones/.../fetch` repeatedly. |
| No PostGIS on Vercel Postgres  | Supabase ships PostGIS by default.                           |
