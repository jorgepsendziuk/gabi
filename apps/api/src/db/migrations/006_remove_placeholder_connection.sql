-- Remove conexão fictícia "Banco local (padrão)" — o meta GABI é sempre o .env da API.
DELETE FROM gabi_page WHERE connection_id = 'conn_default';
DELETE FROM gabi_data_source WHERE connection_id = 'conn_default';
DELETE FROM gabi_odk_change WHERE connection_id = 'conn_default';
DELETE FROM gabi_connection WHERE id = 'conn_default' OR slug = 'default';
