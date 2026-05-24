ALTER TABLE gabi_data_source
  ADD COLUMN IF NOT EXISTS geo_source TEXT
    CHECK (geo_source IS NULL OR geo_source IN ('postgis', 'latlon', 'geopoint', 'geolocation'));

CREATE INDEX IF NOT EXISTS idx_gabi_data_source_geo ON gabi_data_source(geo_source)
  WHERE geo_source IS NOT NULL;

INSERT INTO gabi_migration (name) VALUES ('supabase_08_geo_source')
ON CONFLICT (name) DO NOTHING;
