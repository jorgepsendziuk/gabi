import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { normalizeListPageConfig, visibleListColumns } from '@gabi/core';
import { Alert, PageHeader } from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { recordEditPath } from '../lib/dynamicPaths';
import { RecordFieldDisplay } from '../components/RecordFieldDisplay';

interface DataSourceMeta {
  recordKeyColumn?: string;
  odkReadOnly: boolean;
}

export function DynamicRecordDetailPage() {
  const { resource, recordId } = useParams<{ resource: string; recordId: string }>();
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<Array<{ field: string; header: string }>>([]);
  const [dsMeta, setDsMeta] = useState<DataSourceMeta | null>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const cfg = normalizeListPageConfig(listPage.config);
        setFields(
          visibleListColumns(cfg).map((c) => ({ field: c.field, header: c.header })),
        );

        const meta = await apiFetch<DataSourceMeta>(
          `/api/generator/data-sources/${listPage.dataSourceId}`,
        );
        setDsMeta(meta);

        const row = await apiFetch<Record<string, unknown>>(
          `/api/runtime/${listPage.dataSourceId}/records/${recordId}`,
        );
        setRecord(row);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [resource, recordId]);

  const displayFields = useMemo(() => {
    if (fields.length > 0) return fields;
    if (!record) return [];
    return Object.keys(record)
      .filter((k) => k !== '_gabi')
      .slice(0, 24)
      .map((k) => ({ field: k, header: k }));
  }, [fields, record]);

  if (loading) return <p className="text-gabi-muted text-sm">Carregando registro…</p>;

  if (error || !record || !resource || !recordId) {
    return (
      <Alert variant="warning">
        {error || 'Registro não encontrado.'}
        <div className="mt-3">
          <Link to={`/p/${resource}/list`} className="gabi-btn gabi-btn--outline gabi-btn--sm">
            Voltar à lista
          </Link>
        </div>
      </Alert>
    );
  }

  const canEdit = dsMeta?.odkReadOnly === true;

  return (
    <div>
      <PageHeader
        title="Visualizar registro"
        description={label}
        actions={
          <>
            <Link to={`/p/${resource}/list`} className="gabi-btn gabi-btn--outline gabi-btn--sm">
              Voltar
            </Link>
            {canEdit && (
              <Link
                to={recordEditPath(resource, recordId)}
                className="gabi-btn gabi-btn--accent gabi-btn--sm"
              >
                Editar
              </Link>
            )}
          </>
        }
      />
      <RecordFieldDisplay record={record} fields={displayFields} />
      {!canEdit && dsMeta && (
        <p className="text-xs text-gabi-muted mt-4">
          Edição disponível apenas para fontes com overlay ODK.
        </p>
      )}
    </div>
  );
}
