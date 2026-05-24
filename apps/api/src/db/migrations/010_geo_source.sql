ALTER TABLE gabi_data_source
  ADD COLUMN IF NOT EXISTS geo_source TEXT
    CHECK (geo_source IS NULL OR geo_source IN ('postgis', 'latlon', 'geopoint', 'geolocation'));

COMMENT ON COLUMN gabi_data_source.geo_source IS 'Formato das coordenadas: postgis, latlon, geopoint (ODK), geolocation (ODK JSON)';
