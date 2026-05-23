export * from './record-key.js';
export * from './merge.js';

import type { TableMeta } from '@gabi/core';

const ODK_COLUMN_PATTERNS = [
  /^_id$/i,
  /^_uuid$/i,
  /^_submission_time$/i,
  /^_version$/i,
  /^_status$/i,
  /^meta::/i,
];

export interface OdkDetection {
  isOdkTable: boolean;
  confidence: number;
  signals: string[];
}

export function detectOdkTable(table: TableMeta): OdkDetection {
  const signals: string[] = [];
  const colNames = table.columns.map((c) => c.name);

  for (const pattern of ODK_COLUMN_PATTERNS) {
    const match = colNames.find((n) => pattern.test(n));
    if (match) signals.push(`column:${match}`);
  }

  if (table.name.includes('_repeat') || table.name.endsWith('_repeat')) {
    signals.push('repeat_table');
  }

  const isOdkTable = signals.length >= 2;
  const confidence = Math.min(1, signals.length / 4);

  return { isOdkTable, confidence, signals };
}
