#!/usr/bin/env node
import { config } from 'dotenv';
import { Command } from 'commander';
import { getConfigFromEnv, getPool } from '@gabi/db';
import { introspectDatabase } from '@gabi/introspector';
import { generatePage, suggestPageTypes } from '@gabi/generator';

config();

const program = new Command();

program.name('gabi').description('GABI CLI — Geo-Aplicações & Business Intelligence').version('0.1.0');

program
  .command('connect')
  .description('Testa conexão com PostgreSQL')
  .option('--host <host>')
  .option('--port <port>')
  .option('--database <db>')
  .option('--user <user>')
  .option('--password <password>')
  .action(async (opts) => {
    const cfg = {
      host: opts.host ?? process.env.DB_HOST ?? 'localhost',
      port: Number(opts.port ?? process.env.DB_PORT ?? 5432),
      database: opts.database ?? process.env.DB_NAME ?? 'gabi',
      user: opts.user ?? process.env.DB_USER ?? 'gabi',
      password: opts.password ?? process.env.DB_PASSWORD ?? 'gabi',
    };
    const pool = getPool('cli', cfg);
    const rows = await pool.query('SELECT version()');
    console.log('Conexão OK:', rows.rows[0]?.version);
    await pool.end();
  });

program
  .command('introspect')
  .description('Lista tabelas e capacidades geoespaciais')
  .action(async () => {
    const pool = getPool('cli', getConfigFromEnv());
    const result = await introspectDatabase(pool);
    console.log(`Escaneado em: ${result.scannedAt}`);
    console.log(`Tabelas/views: ${result.tables.length}\n`);
    for (const t of result.tables) {
      const types = suggestPageTypes(t).join(', ');
      const geo = t.geometryColumn ? ` [geom: ${t.geometryColumn}]` : '';
      console.log(`  ${t.schema}.${t.name} (${t.type}) — templates: ${types}${geo}`);
    }
    await pool.end();
  });

program
  .command('generate')
  .description('Gera metadados de página (chama API se GABI_API_URL definido)')
  .requiredOption('--schema <schema>')
  .requiredOption('--table <table>')
  .option('--connection <id>', 'ID da conexão GABI', 'conn_default')
  .option('--template <type>', 'list | map', 'list')
  .action(async (opts) => {
    const apiUrl = process.env.GABI_API_URL ?? 'http://localhost:4000';
    const token = process.env.GABI_ADMIN_TOKEN;

    if (token) {
      const res = await fetch(`${apiUrl}/api/generator/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          connectionId: opts.connection,
          schema: opts.schema,
          table: opts.table,
          template: opts.template,
        }),
      });
      if (!res.ok) {
        console.error('Erro API:', await res.text());
        process.exit(1);
      }
      console.log('Página registrada via API:', (await res.json()) as { page: { id: string } });
      return;
    }

    const pool = getPool('cli', getConfigFromEnv());
    const result = await introspectDatabase(pool);
    const table = result.tables.find((t) => t.schema === opts.schema && t.name === opts.table);
    if (!table) {
      console.error(`Tabela não encontrada: ${opts.schema}.${opts.table}`);
      process.exit(1);
    }

    const generated = generatePage({
      connectionId: opts.connection,
      table,
      type: opts.template as 'list' | 'map',
    });
    console.log(JSON.stringify(generated, null, 2));
    console.log('\nDefina GABI_ADMIN_TOKEN para persistir via API.');
    await pool.end();
  });

program.parse();
