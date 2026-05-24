import type { TableMeta } from '@gabi/core';
import { getOdkFormSchemaForSubmissionTable, odkFieldsToColumnLabels } from '@gabi/odk';
import type pg from 'pg';

/** Carrega labels ODK para colunas da tabela de submissão (somente leitura no Postgres ODK). */
export async function loadOdkColumnLabels(
  pool: pg.Pool,
  table: TableMeta,
  isOdkSource: boolean,
): Promise<Record<string, string> | undefined> {
  if (!isOdkSource) return undefined;
  try {
    const schema = await getOdkFormSchemaForSubmissionTable(pool, table.schema, table.name);
    if (!schema?.fields.length) return undefined;
    return odkFieldsToColumnLabels(schema.fields);
  } catch {
    return undefined;
  }
}
