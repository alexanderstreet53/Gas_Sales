-- PostgREST returns geometry/geography columns as hex EWKB by default,
-- which the application can't use directly. This view exposes zone
-- boundaries already converted to GeoJSON so the app reads them without
-- depending on any project-level Supabase setting.
--
-- Apply once via the Supabase SQL Editor.

create or replace view zones_geojson as
  select
    id,
    name,
    description,
    zoom,
    status,
    created_by,
    created_at,
    updated_at,
    deleted_at,
    st_asgeojson(boundary)::jsonb as boundary
  from zones;

grant select on zones_geojson to anon, authenticated, service_role;
