import { query } from '@gabi/db';
import type pg from 'pg';
import { findTablesByName, listAccessibleSchemas, type TableRef } from './schema-probe.js';

export type OdkPlatformKind = 'central' | 'aggregate' | 'unknown';

export interface OdkPlatformDetection {
  platform: OdkPlatformKind;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  schemas: string[];
  tables: Record<string, TableRef | undefined>;
}

const CENTRAL_MARKERS = ['users', 'actors', 'forms', 'projects'] as const;
const AGGREGATE_MARKERS = [
  '_registered_users',
  '_form_info',
  '_server_preferences',
  '_form_data_model',
  '_user_granted_authority',
] as const;

export async function detectOdkPlatform(pool: pg.Pool): Promise<OdkPlatformDetection> {
  const schemas = await listAccessibleSchemas(pool);
  const centralTables = await findTablesByName(pool, [...CENTRAL_MARKERS]);
  const aggregateTables = await findTablesByName(pool, [...AGGREGATE_MARKERS]);

  const centralHits = CENTRAL_MARKERS.filter((n) => centralTables.has(n));
  const aggregateHits = AGGREGATE_MARKERS.filter((n) => aggregateTables.has(n));

  const signals: string[] = [];
  let platform: OdkPlatformKind = 'unknown';
  let confidence: OdkPlatformDetection['confidence'] = 'low';

  const tables: Record<string, TableRef | undefined> = {};
  for (const [k, v] of centralTables) tables[k] = v;
  for (const [k, v] of aggregateTables) if (!tables[k]) tables[k] = v;

  if (centralHits.length >= 3) {
    platform = 'central';
    confidence = centralHits.length >= 4 ? 'high' : 'medium';
    signals.push(`central:${centralHits.join(',')}`);
  }

  if (aggregateHits.length >= 2) {
    if (platform === 'central') {
      signals.push(`also_aggregate:${aggregateHits.join(',')}`);
    } else {
      platform = 'aggregate';
      confidence = aggregateHits.length >= 3 ? 'high' : 'medium';
      signals.push(`aggregate:${aggregateHits.join(',')}`);
    }
  }

  if (platform === 'unknown') {
    const odkSubmission = await query<{ n: string }>(
      pool,
      `
      SELECT count(*)::text AS n
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND column_name IN ('_uuid', '__system', 'meta')
      `,
    );
    const colCount = Number(odkSubmission[0]?.n ?? 0);
    if (colCount >= 3) {
      platform = 'unknown';
      confidence = 'low';
      signals.push('submission_columns_detected');
    }
  }

  return { platform, confidence, signals, schemas, tables };
}
