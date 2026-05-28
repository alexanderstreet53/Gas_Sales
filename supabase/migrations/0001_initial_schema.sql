-- Gas Tank Detection Platform — initial schema
-- Postgres 16 + PostGIS 3
--
-- Conventions:
--   * All geometry/geography columns use SRID 4326 (WGS84).
--   * Use `geography` for distances on the sphere, `geometry` for
--     planar ops (clipping a zone polygon against a tile grid, etc).
--   * Timestamps are timestamptz, default `now()`.
--   * Soft delete via `deleted_at` where it matters (zones, leads).

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- zones: user-defined polygons we will scan
-- ---------------------------------------------------------------------------
create table zones (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  boundary        geography(Polygon, 4326) not null,
  zoom            integer not null default 19 check (zoom between 14 and 21),
  status          text not null default 'draft'
                    check (status in ('draft','active','paused','archived')),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index zones_boundary_gix on zones using gist (boundary);
create index zones_status_idx   on zones (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- imagery_tiles: cache record for every tile we fetch
--
-- Storage path lives in Supabase Storage bucket `imagery`, keyed by
-- (provider, kind, z, x, y) for satellite or (provider, kind, lat, lng, heading)
-- for street view. We hash the params into `cache_key` for a stable lookup.
-- ---------------------------------------------------------------------------
create table imagery_tiles (
  id              uuid primary key default uuid_generate_v4(),
  zone_id         uuid references zones(id) on delete set null,
  provider        text not null default 'google',
  kind            text not null check (kind in ('satellite','streetview')),
  cache_key       text not null unique,
  z               integer,
  x               integer,
  y               integer,
  center          geography(Point, 4326) not null,
  bounds          geometry(Polygon, 4326),         -- satellite tiles only
  heading         integer,                          -- streetview only
  pitch           integer,                          -- streetview only
  width_px        integer not null,
  height_px       integer not null,
  storage_path    text not null,                    -- imagery/<key>.jpg
  bytes           integer,
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  meta            jsonb not null default '{}'::jsonb
);
create index imagery_tiles_zone_idx    on imagery_tiles (zone_id);
create index imagery_tiles_kind_idx    on imagery_tiles (kind);
create index imagery_tiles_expires_idx on imagery_tiles (expires_at);
create index imagery_tiles_center_gix  on imagery_tiles using gist (center);

-- ---------------------------------------------------------------------------
-- detections: raw YOLO outputs, one row per bounding box
-- ---------------------------------------------------------------------------
create table detections (
  id              uuid primary key default uuid_generate_v4(),
  tile_id         uuid not null references imagery_tiles(id) on delete cascade,
  zone_id         uuid references zones(id) on delete cascade,
  class           text not null,
  confidence      real not null check (confidence between 0 and 1),
  bbox_pixels     integer[] not null,             -- [x1,y1,x2,y2] in tile px
  location        geography(Point, 4326) not null, -- bbox centroid, georef'd
  footprint       geography(Polygon, 4326),         -- bbox corners, georef'd
  model_version   text not null,
  reviewed        boolean not null default false,
  review_result   text check (review_result in ('confirmed','rejected')),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index detections_tile_idx       on detections (tile_id);
create index detections_zone_idx       on detections (zone_id);
create index detections_location_gix   on detections using gist (location);
create index detections_unreviewed_idx on detections (zone_id, reviewed)
  where reviewed = false;

-- ---------------------------------------------------------------------------
-- sites: detections clustered into candidate premises
-- ---------------------------------------------------------------------------
create table sites (
  id              uuid primary key default uuid_generate_v4(),
  zone_id         uuid not null references zones(id) on delete cascade,
  centroid        geography(Point, 4326) not null,
  hull            geography(Polygon, 4326),
  detection_count integer not null default 0,
  best_confidence real not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index sites_zone_idx     on sites (zone_id);
create index sites_centroid_gix on sites using gist (centroid);

-- Detection ↔ site membership (many detections, one site)
alter table detections
  add column site_id uuid references sites(id) on delete set null;
create index detections_site_idx on detections (site_id);

-- ---------------------------------------------------------------------------
-- leads: sales-ready records, one per site
-- ---------------------------------------------------------------------------
create table leads (
  id              uuid primary key default uuid_generate_v4(),
  site_id         uuid not null unique references sites(id) on delete cascade,
  zone_id         uuid not null references zones(id) on delete cascade,
  address         text,
  formatted_addr  text,
  place_id        text,                              -- Google Place ID if matched
  business_name   text,
  business_type   text,
  enrichment      jsonb not null default '{}'::jsonb, -- raw Places / CH payload
  confidence      real not null default 0,
  status          text not null default 'new'
                    check (status in ('new','verified','contacted','converted','rejected')),
  notes           text,
  assigned_to     uuid,
  contacted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index leads_zone_idx   on leads (zone_id);
create index leads_status_idx on leads (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- training_labels: hand-labelled crops for the model
-- ---------------------------------------------------------------------------
create table training_labels (
  id              uuid primary key default uuid_generate_v4(),
  tile_id         uuid not null references imagery_tiles(id) on delete cascade,
  class           text not null,                    -- e.g. 'cylinder', 'bulk_tank'
  bbox_pixels     integer[] not null,               -- [x1,y1,x2,y2]
  labeller        uuid,
  is_negative     boolean not null default false,   -- true => no-object crop
  notes           text,
  created_at      timestamptz not null default now()
);
create index training_labels_tile_idx  on training_labels (tile_id);
create index training_labels_class_idx on training_labels (class);

-- ---------------------------------------------------------------------------
-- api_spend: per-request cost log for the running spend counter
-- ---------------------------------------------------------------------------
create table api_spend (
  id              bigserial primary key,
  provider        text not null,                    -- 'google_static','google_streetview',...
  endpoint        text not null,
  zone_id         uuid references zones(id) on delete set null,
  units           integer not null default 1,
  est_cost_usd    numeric(10,5) not null,
  cache_hit       boolean not null default false,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index api_spend_created_idx  on api_spend (created_at desc);
create index api_spend_provider_idx on api_spend (provider, created_at desc);
create index api_spend_zone_idx     on api_spend (zone_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger zones_set_updated  before update on zones  for each row execute function set_updated_at();
create trigger sites_set_updated  before update on sites  for each row execute function set_updated_at();
create trigger leads_set_updated  before update on leads  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security — locked down by default; the service role bypasses.
-- Adjust policies once auth is wired up; the worker uses the service role key.
-- ---------------------------------------------------------------------------
alter table zones           enable row level security;
alter table imagery_tiles   enable row level security;
alter table detections      enable row level security;
alter table sites           enable row level security;
alter table leads           enable row level security;
alter table training_labels enable row level security;
alter table api_spend       enable row level security;

-- Authenticated users get full read; writes through API only (service role).
create policy "auth read zones"           on zones           for select using (auth.role() = 'authenticated');
create policy "auth read imagery_tiles"   on imagery_tiles   for select using (auth.role() = 'authenticated');
create policy "auth read detections"      on detections      for select using (auth.role() = 'authenticated');
create policy "auth read sites"           on sites           for select using (auth.role() = 'authenticated');
create policy "auth read leads"           on leads           for select using (auth.role() = 'authenticated');
create policy "auth read training_labels" on training_labels for select using (auth.role() = 'authenticated');
create policy "auth read api_spend"       on api_spend       for select using (auth.role() = 'authenticated');
