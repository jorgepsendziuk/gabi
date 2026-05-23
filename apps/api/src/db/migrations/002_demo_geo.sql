-- Demo geospatial table for MVP
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.familias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  municipio TEXT,
  renda NUMERIC(12, 2),
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.familias (nome, municipio, renda, geom)
SELECT
  'Família ' || g,
  CASE (g % 3) WHEN 0 THEN 'Brasília' WHEN 1 THEN 'Goiânia' ELSE 'Palmas' END,
  (random() * 5000 + 1000)::numeric(12,2),
  ST_SetSRID(ST_MakePoint(-47.9 + (random() * 2 - 1), -15.8 + (random() * 2 - 1)), 4326)
FROM generate_series(1, 25) g
WHERE NOT EXISTS (SELECT 1 FROM public.familias LIMIT 1);
