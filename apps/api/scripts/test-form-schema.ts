import { config } from 'dotenv';
import { getOdkFormSchema } from '@gabi/odk';
import { getConnectionPool, getDefaultConnectionId } from '../src/services/connections.js';

config({ path: '.env' });

const formId = process.argv[2] ?? 'laudov1';

const pool = await getConnectionPool(await getDefaultConnectionId());
const schema = await getOdkFormSchema(pool, formId);
console.log(
  formId,
  'fields:',
  schema.fieldCount,
  'mapped:',
  schema.dataModelMapped,
  'warnings:',
  schema.warnings,
);
const sample = schema.fields.filter((f) => f.label && f.choices?.length).slice(0, 3);
for (const f of sample) {
  console.log('\n-', f.path, f.label, f.dbColumn);
  console.log('  choices:', f.choices?.slice(0, 4).map((c) => `${c.value}=${c.label}`).join(', '));
}
const withLabel = schema.fields.filter((f) => f.label).length;
console.log('\nwith label:', withLabel);
