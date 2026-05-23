import { config } from 'dotenv';
import { getDefaultPool } from '@gabi/db';
import { introspectDatabase } from '@gabi/introspector';
import { generatePage } from '@gabi/generator';
import { getConnectionPool } from '../services/connections.js';
import { saveDataSource, savePage, addPermissionsForResource } from '../services/store.js';

config();

const CONNECTION_ID = 'conn_default';

async function seedDemoPages() {
  const metaPool = getDefaultPool();
  const pool = await getConnectionPool(CONNECTION_ID);
  const intro = await introspectDatabase(pool);
  const familias = intro.tables.find((t) => t.schema === 'public' && t.name === 'familias');
  if (!familias) {
    console.log('Tabela public.familias não encontrada — pule seed de páginas.');
    await metaPool.end();
    return;
  }

  await metaPool.query(`DELETE FROM gabi_page WHERE connection_id = $1`, [CONNECTION_ID]);
  await metaPool.query(`DELETE FROM gabi_data_source WHERE connection_id = $1`, [CONNECTION_ID]);

  for (const template of ['list', 'map'] as const) {
    try {
      const generated = generatePage({ connectionId: CONNECTION_ID, table: familias, type: template });
      await saveDataSource(generated.dataSource);
      await savePage(generated.page);
      await addPermissionsForResource(
        generated.page.resource,
        generated.permissions.map((p) => p.action),
      );
      console.log(`Página demo: ${generated.page.label} (${generated.dataSource.id})`);
    } catch (e) {
      console.log(`Skip ${template}:`, (e as Error).message);
    }
  }

  await metaPool.end();
}

seedDemoPages().catch(console.error);
