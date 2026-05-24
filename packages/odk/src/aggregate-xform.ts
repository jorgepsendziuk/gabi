import { query } from '@gabi/db';
import type pg from 'pg';
import { findTablesByName, quoteIdent, type TableRef } from './schema-probe.js';

export interface AggregateFormRef {
  formUri: string;
  formId: string;
  formName?: string;
  filesetUri: string;
  modelVersion?: number;
}

/** Resolve tabelas blob do Aggregate (schema odk_prod ou public). */
export async function resolveAggregateBlobTables(
  pool: pg.Pool,
): Promise<{
  schema: string;
  formInfo: TableRef;
  fileset: TableRef;
  xformBin: TableRef;
  xformRef: TableRef;
  xformBlb: TableRef;
  dataModel: TableRef;
  submissionAssoc?: TableRef;
}> {
  const found = await findTablesByName(pool, [
    '_form_info',
    '_form_info_fileset',
    '_form_info_xform_bin',
    '_form_info_xform_ref',
    '_form_info_xform_blb',
    '_form_data_model',
    '_form_info_submission_association',
  ]);

  const formInfo = found.get('_form_info');
  const fileset = found.get('_form_info_fileset');
  const xformBin = found.get('_form_info_xform_bin');
  const xformRef = found.get('_form_info_xform_ref');
  const xformBlb = found.get('_form_info_xform_blb');
  const dataModel = found.get('_form_data_model');

  if (!formInfo || !fileset || !xformBin || !xformRef || !xformBlb || !dataModel) {
    throw new Error(
      'Tabelas ODK Aggregate não encontradas (_form_info, _form_info_xform_*, _form_data_model)',
    );
  }

  return {
    schema: formInfo.schema,
    formInfo,
    fileset,
    xformBin,
    xformRef,
    xformBlb,
    dataModel,
    submissionAssoc: found.get('_form_info_submission_association'),
  };
}

export async function listAggregateForms(
  pool: pg.Pool,
  tables: Awaited<ReturnType<typeof resolveAggregateBlobTables>>,
): Promise<AggregateFormRef[]> {
  const fi = quoteIdent(tables.formInfo.schema, tables.formInfo.name);
  const fs = quoteIdent(tables.fileset.schema, tables.fileset.name);

  const rows = await query<{
    form_uri: string;
    form_id: string;
    fileset_uri: string;
    form_name: string | null;
    model_version: number | null;
  }>(
    pool,
    `
    SELECT
      fi."_URI" AS form_uri,
      fi."FORM_ID" AS form_id,
      fs."_URI" AS fileset_uri,
      fs."FORM_NAME" AS form_name,
      fs."ROOT_ELEMENT_MODEL_VERSION" AS model_version
    FROM ${fi} fi
    JOIN ${fs} fs ON fs."_PARENT_AURI" = fi."_URI"
    WHERE fs."_ORDINAL_NUMBER" = (
      SELECT MAX(fs2."_ORDINAL_NUMBER")
      FROM ${fs} fs2
      WHERE fs2."_PARENT_AURI" = fi."_URI"
    )
    ORDER BY fi."FORM_ID"
    `,
  );

  return rows.map((r) => ({
    formUri: r.form_uri,
    formId: r.form_id,
    formName: r.form_name ?? undefined,
    filesetUri: r.fileset_uri,
    modelVersion: r.model_version ?? undefined,
  }));
}

export async function resolveAggregateFormById(
  pool: pg.Pool,
  tables: Awaited<ReturnType<typeof resolveAggregateBlobTables>>,
  formIdOrUri: string,
): Promise<AggregateFormRef | null> {
  const key = formIdOrUri.toLowerCase();
  const forms = await listAggregateForms(pool, tables);
  return (
    forms.find(
      (f) =>
        f.formId.toLowerCase() === key ||
        f.formUri.toLowerCase() === key ||
        f.filesetUri.toLowerCase() === key,
    ) ?? null
  );
}

/** Lê o XForm XML completo a partir das tabelas _form_info_xform_* do Aggregate. */
export async function readAggregateXformXml(
  pool: pg.Pool,
  tables: Awaited<ReturnType<typeof resolveAggregateBlobTables>>,
  filesetUri: string,
): Promise<string> {
  const binT = quoteIdent(tables.xformBin.schema, tables.xformBin.name);
  const refT = quoteIdent(tables.xformRef.schema, tables.xformRef.name);
  const blbT = quoteIdent(tables.xformBlb.schema, tables.xformBlb.name);

  const bins = await query<{ _uri: string }>(
    pool,
    `SELECT "_URI" AS _uri FROM ${binT} WHERE "_PARENT_AURI" = $1 LIMIT 1`,
    [filesetUri],
  );
  const binUri = bins[0]?._uri;
  if (!binUri) {
    throw new Error(`Definição XForm não encontrada para fileset ${filesetUri}`);
  }

  const parts = await query<{ value: Buffer }>(
    pool,
    `
    SELECT b."VALUE" AS value
    FROM ${refT} r
    JOIN ${blbT} b ON b."_URI" = r."_SUB_AURI"
    WHERE r."_DOM_AURI" = $1
    ORDER BY r."PART" ASC
    `,
    [binUri],
  );

  if (parts.length === 0) {
    throw new Error(`Blob XForm vazio para bin ${binUri}`);
  }

  const buffer = Buffer.concat(parts.map((p) => p.value));
  return buffer.toString('utf8');
}

export interface FormDataModelRow {
  elementName: string;
  elementType: string;
  dbSchema?: string;
  dbTable?: string;
  dbColumn?: string;
  parentUri?: string;
  ordinal?: number;
}

export async function loadFormDataModel(
  pool: pg.Pool,
  tables: Awaited<ReturnType<typeof resolveAggregateBlobTables>>,
  submissionModelUri: string,
): Promise<FormDataModelRow[]> {
  const dm = quoteIdent(tables.dataModel.schema, tables.dataModel.name);
  const rows = await query<Record<string, unknown>>(
    pool,
    `
    SELECT
      "ELEMENT_NAME",
      "ELEMENT_TYPE",
      "PERSIST_AS_SCHEMA_NAME",
      "PERSIST_AS_TABLE_NAME",
      "PERSIST_AS_COLUMN_NAME",
      "PARENT_URI_FORM_DATA_MODEL",
      "ORDINAL_NUMBER"
    FROM ${dm}
    WHERE "URI_SUBMISSION_DATA_MODEL" = $1
    ORDER BY "ORDINAL_NUMBER" NULLS LAST, "ELEMENT_NAME"
    `,
    [submissionModelUri],
  );

  return rows.map((r) => ({
    elementName: String(r.ELEMENT_NAME ?? ''),
    elementType: String(r.ELEMENT_TYPE ?? ''),
    dbSchema: r.PERSIST_AS_SCHEMA_NAME ? String(r.PERSIST_AS_SCHEMA_NAME) : undefined,
    dbTable: r.PERSIST_AS_TABLE_NAME ? String(r.PERSIST_AS_TABLE_NAME) : undefined,
    dbColumn: r.PERSIST_AS_COLUMN_NAME ? String(r.PERSIST_AS_COLUMN_NAME) : undefined,
    parentUri: r.PARENT_URI_FORM_DATA_MODEL ? String(r.PARENT_URI_FORM_DATA_MODEL) : undefined,
    ordinal: r.ORDINAL_NUMBER != null ? Number(r.ORDINAL_NUMBER) : undefined,
  }));
}

export async function resolveSubmissionModelUri(
  pool: pg.Pool,
  tables: Awaited<ReturnType<typeof resolveAggregateBlobTables>>,
  form: AggregateFormRef,
): Promise<string | null> {
  if (!tables.submissionAssoc) return null;

  const assoc = quoteIdent(tables.submissionAssoc.schema, tables.submissionAssoc.name);
  const rows = await query<{ uri: string }>(
    pool,
    `
    SELECT "URI_SUBMISSION_DATA_MODEL" AS uri
    FROM ${assoc}
    WHERE "URI_MD5_FORM_ID" = $1 OR "SUBMISSION_FORM_ID" = $2
    ORDER BY "_LAST_UPDATE_DATE" DESC NULLS LAST
    LIMIT 1
    `,
    [form.formUri, form.formId],
  );
  return rows[0]?.uri ?? null;
}
