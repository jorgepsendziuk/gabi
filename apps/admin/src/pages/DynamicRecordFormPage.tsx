import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { normalizeListPageConfig, visibleListColumns } from '@gabi/core';
import { Alert, Button, Card, Field, Input, PageHeader } from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { recordViewPath } from '../lib/dynamicPaths';

interface DataSourceMeta {
  odkReadOnly: boolean;
  columns: Array<{ name: string; dataType: string; isGeometry: boolean }>;
}

function getField(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const key = Object.keys(row).find((k) => k.toLowerCase() === field.toLowerCase());
  return key ? row[key] : undefined;
}

function valueToInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function inputToValue(raw: string, dataType: string): unknown {
  const t = raw.trim();
  if (t === '') return null;
  if (['integer', 'bigint', 'smallint'].includes(dataType)) {
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? t : n;
  }
  if (['numeric', 'real', 'double precision', 'decimal'].includes(dataType)) {
    const n = Number.parseFloat(t);
    return Number.isNaN(n) ? t : n;
  }
  if (dataType === 'boolean') return t === 'true' || t === '1';
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  return t;
}

export function DynamicRecordFormPage() {
  const { resource, recordId } = useParams<{ resource: string; recordId: string }>();
  const navigate = useNavigate();
  const [dataSourceId, setDataSourceId] = useState('');
  const [label, setLabel] = useState('');
  const [editableFields, setEditableFields] = useState<
    Array<{ field: string; header: string; dataType: string }>
  >([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [readOnlyReason, setReadOnlyReason] = useState('');

  useEffect(() => {
    if (!resource || !recordId) return;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const pages = await apiFetch<
          Array<{
            resource: string;
            type: string;
            dataSourceId: string;
            label: string;
            config: Record<string, unknown>;
          }>
        >('/api/generator/pages');
        const listPage = pages.find((p) => p.resource === resource && p.type === 'list');
        if (!listPage) {
          setError('Lista não encontrada.');
          return;
        }
        setLabel(listPage.label);
        setDataSourceId(listPage.dataSourceId);

        const meta = await apiFetch<DataSourceMeta>(
          `/api/generator/data-sources/${listPage.dataSourceId}`,
        );
        if (!meta.odkReadOnly) {
          setReadOnlyReason(
            'Esta fonte não usa overlay ODK. A edição direta no banco externo não está habilitada.',
          );
          return;
        }

        const cfg = normalizeListPageConfig(listPage.config);
        const colFields = visibleListColumns(cfg);
        const colMap = new Map(meta.columns.map((c) => [c.name.toLowerCase(), c]));
        const fields = colFields
          .filter((c) => {
            const col = colMap.get(c.field.toLowerCase());
            return col && !col.isGeometry;
          })
          .map((c) => ({
            field: c.field,
            header: c.header,
            dataType: colMap.get(c.field.toLowerCase())?.dataType ?? 'text',
          }));
        setEditableFields(fields);

        const row = await apiFetch<Record<string, unknown>>(
          `/api/runtime/${listPage.dataSourceId}/records/${recordId}`,
        );
        const initial: Record<string, string> = {};
        for (const f of fields) {
          initial[f.field] = valueToInput(getField(row, f.field));
        }
        setForm(initial);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [resource, recordId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataSourceId || !recordId || readOnlyReason) return;
    setSaving(true);
    setError('');
    try {
      const patch: Record<string, unknown> = {};
      for (const f of editableFields) {
        patch[f.field] = inputToValue(form[f.field] ?? '', f.dataType);
      }
      await apiFetch(`/api/runtime/${dataSourceId}/records/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      navigate(recordViewPath(resource!, recordId));
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gabi-muted text-sm">Carregando…</p>;

  if (readOnlyReason) {
    return (
      <Alert variant="warning">
        {readOnlyReason}
        <div className="mt-3">
          <Link to={`/p/${resource}/list`} className="gabi-btn gabi-btn--outline gabi-btn--sm">
            Voltar à lista
          </Link>
        </div>
      </Alert>
    );
  }

  if (error && editableFields.length === 0) {
    return (
      <Alert variant="danger">
        {error}
        <div className="mt-3">
          <Link to={`/p/${resource}/list`} className="gabi-btn gabi-btn--outline gabi-btn--sm">
            Voltar
          </Link>
        </div>
      </Alert>
    );
  }

  return (
    <div>
      <PageHeader
        title="Editar registro"
        description={label}
        actions={
          <Link
            to={recordViewPath(resource!, recordId!)}
            className="gabi-btn gabi-btn--outline gabi-btn--sm"
          >
            Cancelar
          </Link>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card padding="md">
        <form onSubmit={save} className="space-y-4">
          {editableFields.map((f) => (
            <Field key={f.field} label={f.header}>
              <Input
                value={form[f.field] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.field]: e.target.value }))}
              />
            </Field>
          ))}
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            <Link
              to={recordViewPath(resource!, recordId!)}
              className="gabi-btn gabi-btn--outline gabi-btn--sm"
            >
              Descartar
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
