-- One demo zone (Park Royal industrial estate, west London) so the
-- pipeline can be exercised end-to-end after a fresh migration.

insert into zones (name, description, boundary, zoom, status)
values (
  'Park Royal (demo)',
  'A small slice of Park Royal industrial estate, used for end-to-end testing.',
  ST_GeogFromText('SRID=4326;POLYGON((
    -0.27050 51.52900,
    -0.26500 51.52900,
    -0.26500 51.53300,
    -0.27050 51.53300,
    -0.27050 51.52900
  ))'),
  19,
  'active'
);
