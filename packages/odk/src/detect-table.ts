import type { TableMeta } from '@gabi/core';

/** Colunas típicas de submissão ODK Aggregate / ODK Central */
const ODK_SUBMISSION_COLUMNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /^_uuid$/i, signal: 'column:_uuid', weight: 2 },
  { pattern: /^_id$/i, signal: 'column:_id', weight: 2 },
  { pattern: /^_submission_(time|date)$/i, signal: 'column:_submission', weight: 2 },
  { pattern: /^_version$/i, signal: 'column:_version', weight: 1 },
  { pattern: /^_status$/i, signal: 'column:_status', weight: 1 },
  { pattern: /^_submitter_id$/i, signal: 'column:_submitter_id', weight: 1 },
  { pattern: /^_attachments$/i, signal: 'column:_attachments', weight: 1 },
  { pattern: /^_geolocation$/i, signal: 'column:_geolocation', weight: 1 },
  { pattern: /^_creator_uri_user$/i, signal: 'column:_creator_uri_user', weight: 1 },
  { pattern: /^_last_modified_at$/i, signal: 'column:_last_modified_at', weight: 1 },
  { pattern: /^meta$/i, signal: 'column:meta', weight: 2 },
  { pattern: /^__system$/i, signal: 'column:__system', weight: 2 },
  { pattern: /^meta::/i, signal: 'column:meta::', weight: 1 },
];

/** Colunas de grupos repeat (filhas) */
const ODK_REPEAT_COLUMNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /^_parent_id$/i, signal: 'column:_parent_id', weight: 2 },
  { pattern: /^_parent_table_name$/i, signal: 'column:_parent_table_name', weight: 2 },
  { pattern: /^_ordinal_number$/i, signal: 'column:_ordinal_number', weight: 1 },
];

const ODK_SYSTEM_TABLE = /^(auth_|django_|spatial_|geometry_|geography_|raster_|topology)/i;

/** Catálogo ODK Central / Aggregate — não são tabelas de submissão */
const ODK_METADATA_TABLE =
  /^_(form_info|form_version|forms|manifest|registry|schema|submission_metadata)$/i;

export function isOdkMetadataTable(tableName: string): boolean {
  return ODK_METADATA_TABLE.test(tableName);
}

export type OdkTableRole = 'submission' | 'repeat' | 'attachment' | 'unknown';

export interface OdkDetectionOptions {
  /** Conexão marcada como fonte ODK — relaxa o limiar de detecção */
  connectionIsOdkSource?: boolean;
}

export interface OdkDetection {
  isOdkTable: boolean;
  role: OdkTableRole;
  confidence: number;
  signals: string[];
  score: number;
}

function isRepeatTableName(name: string): boolean {
  return /_repeat(_\d+)?$/i.test(name) || name.includes('_repeat_');
}

function isAttachmentTableName(name: string): boolean {
  return /_attachments?$/i.test(name) || /_blob_file_?/i.test(name);
}

function classifyRole(table: TableMeta, colSignals: string[]): OdkTableRole {
  if (isAttachmentTableName(table.name)) return 'attachment';
  if (isRepeatTableName(table.name) || colSignals.some((s) => s.includes('_parent'))) {
    return 'repeat';
  }
  const hasSubmissionMeta = colSignals.some(
    (s) =>
      s.includes('_uuid') ||
      s.includes('_id') ||
      s.includes('_submission') ||
      s.includes('column:meta'),
  );
  if (hasSubmissionMeta) return 'submission';
  return 'unknown';
}

export function detectOdkTable(
  table: TableMeta,
  options?: OdkDetectionOptions,
): OdkDetection {
  const signals: string[] = [];
  let score = 0;
  const colNames = table.columns.map((c) => c.name);

  if (ODK_SYSTEM_TABLE.test(table.name) || isOdkMetadataTable(table.name)) {
    return { isOdkTable: false, role: 'unknown', confidence: 0, signals: [], score: 0 };
  }

  for (const { pattern, signal, weight } of ODK_SUBMISSION_COLUMNS) {
    const match = colNames.find((n) => pattern.test(n));
    if (match) {
      signals.push(signal);
      score += weight;
    }
  }

  for (const { pattern, signal, weight } of ODK_REPEAT_COLUMNS) {
    const match = colNames.find((n) => pattern.test(n));
    if (match) {
      signals.push(signal);
      score += weight;
    }
  }

  if (isRepeatTableName(table.name)) {
    signals.push('repeat_table_name');
    score += 2;
  }

  if (isAttachmentTableName(table.name)) {
    signals.push('attachment_table_name');
    score += 1;
  }

  const role = classifyRole(table, signals);
  const connectionHint = Boolean(options?.connectionIsOdkSource);

  let isOdkTable: boolean;
  if (connectionHint) {
    // Em banco ODK: repeats/submissões com sinais claros (não qualquer coluna _id solta)
    isOdkTable =
      role === 'repeat' ||
      (role === 'submission' && score >= 2) ||
      score >= 3;
  } else {
    isOdkTable =
      score >= 3 ||
      (role === 'submission' && score >= 2) ||
      (role === 'repeat' && score >= 2);
  }

  const confidence = Math.min(1, score / 6);

  return { isOdkTable, role, confidence, signals, score };
}

export function isLikelyOdkSubmissionTable(table: TableMeta, options?: OdkDetectionOptions): boolean {
  const d = detectOdkTable(table, options);
  return d.isOdkTable && (d.role === 'submission' || d.role === 'unknown');
}
