import type pg from 'pg';
import { detectOdkPlatform } from './detect-platform.js';
import {
  loadFormDataModel,
  listAggregateForms,
  readAggregateXformXml,
  resolveAggregateBlobTables,
  resolveAggregateFormById,
  resolveSubmissionModelUri,
  type AggregateFormRef,
} from './aggregate-xform.js';
import { parseXFormXml, type OdkFormField } from './parse-xform.js';

export interface OdkFormSchemaResult {
  platform: 'aggregate' | 'central' | 'unknown';
  formId: string;
  formName?: string;
  formUri?: string;
  xmlFormId?: string;
  fieldCount: number;
  fields: OdkFormField[];
  dataModelMapped: number;
  warnings: string[];
}

function mergeDataModel(fields: OdkFormField[], model: Awaited<ReturnType<typeof loadFormDataModel>>): number {
  const byName = new Map(model.map((m) => [m.elementName.toLowerCase(), m]));
  let mapped = 0;

  for (const field of fields) {
    const row =
      byName.get(field.name.toLowerCase()) ??
      byName.get(field.path.split('/').pop()?.toLowerCase() ?? '');
    if (!row?.dbColumn) continue;
    field.dbSchema = row.dbSchema;
    field.dbTable = row.dbTable;
    field.dbColumn = row.dbColumn;
    if (row.elementType && field.type === 'string') {
      field.type = row.elementType.toLowerCase();
    }
    mapped += 1;
  }
  return mapped;
}

async function getAggregateFormSchema(
  pool: pg.Pool,
  formId: string,
): Promise<OdkFormSchemaResult> {
  const warnings: string[] = [];
  const tables = await resolveAggregateBlobTables(pool);
  const form: AggregateFormRef | null = await resolveAggregateFormById(pool, tables, formId);
  if (!form) {
    throw new Error(`Formulário ODK não encontrado: ${formId}`);
  }

  const xml = await readAggregateXformXml(pool, tables, form.filesetUri);
  const parsed = parseXFormXml(xml);

  const submissionModelUri = await resolveSubmissionModelUri(pool, tables, form);
  let mapped = 0;
  if (submissionModelUri) {
    const model = await loadFormDataModel(pool, tables, submissionModelUri);
    mapped = mergeDataModel(parsed.fields, model);
  } else {
    warnings.push('URI_SUBMISSION_DATA_MODEL não encontrado; colunas do banco não foram cruzadas.');
  }

  return {
    platform: 'aggregate',
    formId: form.formId,
    formName: form.formName,
    formUri: form.formUri,
    xmlFormId: parsed.formId ?? form.formId,
    fieldCount: parsed.fields.length,
    fields: parsed.fields,
    dataModelMapped: mapped,
    warnings,
  };
}

/** Lista IDs de formulários disponíveis (Aggregate). */
export async function listOdkFormIds(pool: pg.Pool): Promise<
  Array<{ formId: string; formName?: string; formUri: string }>
> {
  const platform = await detectOdkPlatform(pool);
  if (platform.platform !== 'aggregate') {
    return [];
  }
  const tables = await resolveAggregateBlobTables(pool);
  const forms = await listAggregateForms(pool, tables);
  return forms.map((f) => ({
    formId: f.formId,
    formName: f.formName,
    formUri: f.formUri,
  }));
}

/**
 * Extrai schema de campos (labels, tipos, escolhas) a partir do XForm no banco.
 */
export async function getOdkFormSchema(
  pool: pg.Pool,
  formId: string,
): Promise<OdkFormSchemaResult> {
  const platform = await detectOdkPlatform(pool);

  if (platform.platform === 'aggregate') {
    return getAggregateFormSchema(pool, formId);
  }

  throw new Error(
    platform.platform === 'central'
      ? 'ODK Central: leitura de schema via form_defs em desenvolvimento; use Aggregate ou exporte XML.'
      : 'Plataforma ODK não reconhecida para extração de schema.',
  );
}
