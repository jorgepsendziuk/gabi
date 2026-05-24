-- Limpa artefatos de demo se existirem no meta (tabelas demo não devem estar no Supabase).
DELETE FROM gabi_page
WHERE connection_id IN (SELECT id FROM gabi_connection WHERE slug = 'docker-demo')
   OR resource LIKE '%familias%'
   OR resource LIKE '%odk_submissions%';

DELETE FROM gabi_data_source
WHERE connection_id IN (SELECT id FROM gabi_connection WHERE slug = 'docker-demo')
   OR table_name IN ('familias', 'odk_submissions');

DELETE FROM gabi_odk_change
WHERE connection_id IN (SELECT id FROM gabi_connection WHERE slug = 'docker-demo');

DELETE FROM gabi_connection WHERE slug = 'docker-demo';

DROP TABLE IF EXISTS public.odk_submissions;
DROP TABLE IF EXISTS public.familias;

INSERT INTO gabi_migration (name) VALUES ('supabase_05_drop_demo_artifacts')
ON CONFLICT (name) DO NOTHING;
