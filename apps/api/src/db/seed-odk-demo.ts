import { config } from 'dotenv';
import { getDefaultPool } from '@gabi/db';
import { introspectDatabase } from '@gabi/introspector';
import { detectOdkTable } from '@gabi/odk';
import { generatePage } from '@gabi/generator';
import { inferOdkDataSourceFlags } from '../services/odk-overlay.js';
import { getConnectionPool } from '../services/connections.js';
import { saveDataSource, savePage, addPermissionsForResource } from '../services/store.js';

config();

const CONNECTION_ID = 'conn_default';

async function seedOdkDemo() {
  const meta = getDefaultPool();
  await meta.query(`UPDATE gabi_connection SET is_odk_source = true WHERE id = $1`, [
    CONNECTION_ID,
  ]);

  const pool = await getConnectionPool(CONNECTION_ID);
  const intro = await introspectDatabase(pool);
  const table = intro.tables.find((t) => t.schema === 'public' && t.name === 'odk_submissions');
  if (!table) {
    console.log('Execute a migration 005_odk_demo.sql primeiro.');
    await meta.end();
    return;
  }

  const odk = detectOdkTable(table);
  const flags = inferOdkDataSourceFlags(table, odk.isOdkTable);

  await meta.query(`DELETE FROM gabi_page WHERE data_source_id LIKE $1`, [
    `${CONNECTION_ID}::public.odk_submissions`,
  ]);
  await meta.query(`DELETE FROM gabi_data_source WHERE id LIKE $1`, [
    `${CONNECTION_ID}::public.odk_submissions`,
  ]);

  for (const template of ['list', 'map'] as const) {
    const generated = generatePage({
      connectionId: CONNECTION_ID,
      table,
      type: template,
      odkReadOnly: flags.odkReadOnly,
      recordKeyColumn: flags.recordKeyColumn,
    });
    await saveDataSource(generated.dataSource);
    await savePage(generated.page);
    await addPermissionsForResource(
      generated.page.resource,
      generated.permissions.map((p) => p.action),
    );
    console.log(`ODK demo: ${generated.page.label}`);
  }

  await meta.end();
}

seedOdkDemo().catch(console.error);
