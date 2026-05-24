import { config } from 'dotenv';
import { generatePage } from '@gabi/generator';
import { introspectDatabase } from '@gabi/introspector';
import { loadOdkColumnLabels } from '../src/services/odk-labels.js';
import { getConnectionPool, getConnectionById, getDefaultConnectionId } from '../src/services/connections.js';

config({ path: '.env' });

const connectionId = await getDefaultConnectionId();
const pool = await getConnectionPool(connectionId);
const conn = await getConnectionById(connectionId);
const intro = await introspectDatabase(pool);
const table = intro.tables.find((t) => t.name === 'LAUDOV1_CORE');
if (!table) throw new Error('table not found');

const columnLabels = await loadOdkColumnLabels(pool, table, Boolean(conn.is_odk_source));
const generated = generatePage({
  connectionId,
  table,
  type: 'list',
  columnLabels,
  odkReadOnly: true,
});

const cols = (generated.page.config as { columns: Array<{ field: string; header: string }> }).columns;
console.log('labels loaded:', columnLabels ? Object.keys(columnLabels).length : 0);
console.log(
  'sample headers:',
  cols.filter((c) => c.header !== c.field).slice(0, 5).map((c) => `${c.field} -> ${c.header}`),
);
