import { config } from 'dotenv';
import {
  parseXFormXml,
  readAggregateXformXml,
  resolveAggregateBlobTables,
  resolveAggregateFormById,
} from '@gabi/odk';
import { debugXformParseKeys } from '@gabi/odk';
import { getConnectionPool, getDefaultConnectionId } from '../src/services/connections.js';

config({ path: '.env' });

const pool = await getConnectionPool(await getDefaultConnectionId());
const tables = await resolveAggregateBlobTables(pool);
const form = await resolveAggregateFormById(pool, tables, 'laudov1');
const xml = await readAggregateXformXml(pool, tables, form!.filesetUri);
console.log(debugXformParseKeys(xml));
const parsed = parseXFormXml(xml);
console.log('fields', parsed.fieldCount ?? parsed.fields.length, 'formId', parsed.formId);
console.log('sample', parsed.fields.slice(0, 3));
