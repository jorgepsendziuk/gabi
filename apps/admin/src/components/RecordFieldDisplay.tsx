import { Card } from '@gabi/ui';

function getField(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const key = Object.keys(row).find((k) => k.toLowerCase() === field.toLowerCase());
  return key ? row[key] : undefined;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toLocaleString('pt-BR');
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export interface FieldRow {
  field: string;
  header: string;
}

interface RecordFieldDisplayProps {
  record: Record<string, unknown>;
  fields: FieldRow[];
}

export function RecordFieldDisplay({ record, fields }: RecordFieldDisplayProps) {
  const gabi = record._gabi as
    | {
        hasLocalChanges?: boolean;
        isCreatedLocally?: boolean;
        isDeletedLocally?: boolean;
      }
    | undefined;

  return (
    <Card padding="md">
      {gabi?.hasLocalChanges && (
        <p className="text-sm text-amber-700 mb-4 m-0">
          {gabi.isCreatedLocally && 'Registro criado localmente (overlay ODK).'}
          {gabi.isDeletedLocally && 'Registro marcado como excluído localmente.'}
          {!gabi.isCreatedLocally && !gabi.isDeletedLocally && 'Registro alterado localmente.'}
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 m-0">
        {fields.map((f) => (
          <div key={f.field} className="min-w-0">
            <dt className="text-xs font-medium text-gabi-muted uppercase tracking-wide m-0">
              {f.header}
            </dt>
            <dd className="text-sm mt-0.5 mb-0 font-mono break-all whitespace-pre-wrap">
              {formatValue(getField(record, f.field))}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
