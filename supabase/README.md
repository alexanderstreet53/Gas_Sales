# Supabase

PostGIS schema for the gas tank detection platform.

## Apply migrations

```bash
# Via the Supabase CLI (recommended)
supabase link --project-ref YOUR-PROJECT
supabase db push

# Or directly with psql
psql "$SUPABASE_DB_URL" -f migrations/0001_initial_schema.sql
psql "$SUPABASE_DB_URL" -f seed.sql
```

## Storage bucket

The imagery cache lives in a Storage bucket named `imagery`. Create it once
(public reads OFF, authenticated reads ON):

```sql
insert into storage.buckets (id, name, public) values ('imagery','imagery',false);
```

Or via the dashboard: Storage → New bucket → `imagery`, private.

## Schema overview

| Table             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `zones`           | User-defined polygons; we never fetch imagery outside these.  |
| `imagery_tiles`   | Cache record per fetched tile + storage path + expiry.        |
| `detections`      | Raw YOLO bounding boxes, georeferenced.                       |
| `sites`           | Detections clustered into candidate premises.                 |
| `leads`           | Sales-ready records, one per site, with status + enrichment.  |
| `training_labels` | Hand-labelled crops feeding the fine-tuning loop.             |
| `api_spend`       | Per-request cost log driving the spend dashboard.             |

## Provided indexes

GiST indexes on every geography column. A partial index on
`detections (zone_id, reviewed)` keeps the verification queue fast.
