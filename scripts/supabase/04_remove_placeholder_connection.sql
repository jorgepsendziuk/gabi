-- Remove "Banco local (padrão)" se existir (meta = .env da API, não é uma conexão cadastrada).
DELETE FROM gabi_page WHERE connection_id = 'conn_default';
DELETE FROM gabi_data_source WHERE connection_id = 'conn_default';
DELETE FROM gabi_odk_change WHERE connection_id = 'conn_default';
DELETE FROM gabi_connection WHERE id = 'conn_default' OR slug = 'default';

INSERT INTO gabi_migration (name) VALUES ('supabase_04_remove_placeholder_connection')
ON CONFLICT (name) DO NOTHING;
