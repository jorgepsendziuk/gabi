-- Tabela estilo ODK para testar overlay (no banco meta/demo)
CREATE TABLE IF NOT EXISTS public.odk_submissions (
  _id SERIAL PRIMARY KEY,
  _uuid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  _submission_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome TEXT NOT NULL,
  municipio TEXT,
  geom GEOMETRY(Point, 4326)
);

INSERT INTO public.odk_submissions (nome, municipio, geom)
SELECT
  'Submissão ' || g,
  CASE (g % 2) WHEN 0 THEN 'Brasília' ELSE 'Palmas' END,
  ST_SetSRID(ST_MakePoint(-47.9 + (random() * 0.5), -15.8 + (random() * 0.3)), 4326)
FROM generate_series(1, 10) g
WHERE NOT EXISTS (SELECT 1 FROM public.odk_submissions LIMIT 1);
