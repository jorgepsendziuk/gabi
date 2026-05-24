import type { ForeignKeyMeta, PageType, TableMeta } from '@gabi/core';
import { hasGeoCapability } from '@gabi/introspector';
import {
  detectOdkTable,
  isOdkMetadataTable,
  type OdkDetection,
  type OdkDetectionOptions,
} from './detect-table.js';

export interface OdkRepeatTableRef {
  schema: string;
  name: string;
  linkColumn?: string;
  signals: string[];
}

export interface OdkFormDetection {
  /** Identificador estável: schema.tabela principal */
  id: string;
  label: string;
  schema: string;
  mainTable: string;
  repeatTables: OdkRepeatTableRef[];
  role: 'submission';
  confidence: number;
  signals: string[];
  suggestedPages: PageType[];
}

export interface DetectOdkFormsOptions extends OdkDetectionOptions {
  /** Confiança mínima para listar formulário (0–1). Padrão: > 50% (score ≥ 3). */
  minFormConfidence?: number;
}

function hasSubmissionSignature(table: TableMeta): boolean {
  return table.columns.some((c) =>
    /^(_uuid|_submission_(time|date)|meta|__system)$/i.test(c.name),
  );
}

/** Tabela principal de formulário (exclui catálogo e matches fracos). */
function isOdkSubmissionFormCandidate(
  table: TableMeta,
  detection: OdkDetection,
  minConfidence: number,
): boolean {
  if (isOdkMetadataTable(table.name) || detection.role === 'attachment') return false;
  if (detection.confidence < minConfidence) return false;
  if (detection.role === 'repeat') return false;
  if (detection.role === 'submission') return true;
  // unknown: exige colunas típicas de submissão, não só _id genérico
  return hasSubmissionSignature(table) && detection.score >= 3;
}

function tableKey(schema: string, name: string): string {
  return `${schema}.${name}`;
}

function inferParentFromRepeatName(
  repeatName: string,
  submissionTables: Map<string, TableMeta>,
): string | undefined {
  const base = repeatName.replace(/_repeat(_\d+)?$/i, '');
  for (const [key, t] of submissionTables) {
    if (t.name === base) return key;
    if (repeatName.startsWith(`${t.name}_`)) return key;
  }
  const parts = repeatName.split('_');
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join('_');
    const key = [...submissionTables.keys()].find((k) => k.endsWith(`.${candidate}`));
    if (key) return key;
  }
  return undefined;
}

function findParentViaFk(
  repeat: TableMeta,
  foreignKeys: ForeignKeyMeta[],
  submissionKeys: Set<string>,
): { parentKey: string; linkColumn: string } | undefined {
  for (const fk of foreignKeys) {
    if (fk.schema !== repeat.schema || fk.table !== repeat.name) continue;
    const parentKey = tableKey(fk.referencedSchema, fk.referencedTable);
    if (!submissionKeys.has(parentKey)) continue;
    if (['_parent_id', '_id', 'id'].includes(fk.column.toLowerCase()) || fk.column.startsWith('_')) {
      return { parentKey, linkColumn: fk.column };
    }
  }
  const parentCol = repeat.columns.find((c) => /^_parent_id$/i.test(c.name));
  if (parentCol?.referencedTable) {
    const [refSchema, refTable] = parentCol.referencedTable.includes('.')
      ? parentCol.referencedTable.split('.')
      : [repeat.schema, parentCol.referencedTable];
    const parentKey = tableKey(refSchema!, refTable!);
    if (submissionKeys.has(parentKey)) {
      return { parentKey, linkColumn: parentCol.name };
    }
  }
  return undefined;
}

/**
 * Agrupa tabelas introspectadas em possíveis formulários ODK (submissão + repeats).
 */
export function detectOdkForms(
  tables: TableMeta[],
  foreignKeys: ForeignKeyMeta[] = [],
  options?: DetectOdkFormsOptions,
): OdkFormDetection[] {
  const odkOpts: OdkDetectionOptions = {
    connectionIsOdkSource: options?.connectionIsOdkSource,
  };
  const minFormConfidence = options?.minFormConfidence ?? 0.5;

  const classified = tables.map((t) => ({
    table: t,
    detection: detectOdkTable(t, odkOpts),
  }));

  const submissionTables = new Map<string, TableMeta>();
  const repeatTables: Array<{ table: TableMeta; detection: ReturnType<typeof detectOdkTable> }> = [];

  for (const { table, detection } of classified) {
    if (!detection.isOdkTable) continue;
    const key = tableKey(table.schema, table.name);

    if (detection.role === 'repeat') {
      repeatTables.push({ table, detection });
      continue;
    }

    if (detection.role === 'attachment') continue;

    if (detection.role === 'submission' || detection.role === 'unknown') {
      if (isOdkSubmissionFormCandidate(table, detection, minFormConfidence)) {
        submissionTables.set(key, table);
      }
    }
  }

  const submissionKeys = new Set(submissionTables.keys());
  const repeatsByParent = new Map<string, OdkRepeatTableRef[]>();

  for (const { table, detection } of repeatTables) {
    const repeatKey = tableKey(table.schema, table.name);
    const viaFk = findParentViaFk(table, foreignKeys, submissionKeys);
    const parentKey =
      viaFk?.parentKey ??
      inferParentFromRepeatName(table.name, submissionTables) ??
      null;

    if (!parentKey || !submissionTables.has(parentKey)) {
      // Repeat órfão: tratar como formulário próprio se tiver _parent_id (subform isolado)
      if (!detection.isOdkTable) continue;
      submissionTables.set(repeatKey, table);
      continue;
    }

    const list = repeatsByParent.get(parentKey) ?? [];
    list.push({
      schema: table.schema,
      name: table.name,
      linkColumn: viaFk?.linkColumn,
      signals: detection.signals,
    });
    repeatsByParent.set(parentKey, list);
  }

  const forms: OdkFormDetection[] = [];

  for (const [key, table] of submissionTables) {
    const detection = detectOdkTable(table, odkOpts);
    const repeats = repeatsByParent.get(key) ?? [];
    const formSignals = [
      ...detection.signals,
      ...(repeats.length > 0 ? [`repeats:${repeats.length}`] : []),
    ];

    const suggestedPages: PageType[] = ['list'];
    if (hasGeoCapability(table)) suggestedPages.push('map');

    forms.push({
      id: key,
      label: table.name,
      schema: table.schema,
      mainTable: table.name,
      repeatTables: repeats,
      role: 'submission',
      confidence: Math.min(1, detection.confidence + repeats.length * 0.05),
      signals: formSignals,
      suggestedPages,
    });
  }

  return forms.sort((a, b) => {
    const conf = b.confidence - a.confidence;
    if (conf !== 0) return conf;
    return a.label.localeCompare(b.label);
  });
}
