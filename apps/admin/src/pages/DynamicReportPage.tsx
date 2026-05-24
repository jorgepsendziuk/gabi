import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, PageHeader } from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { ReportEditor } from '../components/ReportEditor';
import { renderReportPreview } from '../lib/reportRender';

interface PageMeta {
  id: string;
  dataSourceId: string;
  label: string;
  config: {
    columns?: Array<{ field: string; header: string }>;
    bodyHtml?: string;
    showDataTable?: boolean;
  };
  schema?: string;
  table?: string;
}

interface ListResult {
  data: Record<string, unknown>[];
  total: number;
}

type ViewMode = 'edit' | 'preview';

export function DynamicReportPage() {
  const { resource } = useParams<{ resource: string }>();
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [bodyHtml, setBodyHtml] = useState('');
  const [showDataTable, setShowDataTable] = useState(true);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [mode, setMode] = useState<ViewMode>('edit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    apiFetch<
      Array<{
        id: string;
        type: string;
        resource: string;
        dataSourceId: string;
        label: string;
        config: PageMeta['config'];
        schema?: string;
        table?: string;
      }>
    >('/api/generator/pages')
      .then((pages) => {
        const p = pages.find((x) => x.resource === resource && x.type === 'report');
        if (p) {
          setPageMeta({
            id: p.id,
            dataSourceId: p.dataSourceId,
            label: p.label,
            config: p.config,
            schema: p.schema,
            table: p.table,
          });
          setBodyHtml(p.config.bodyHtml ?? '<p></p>');
          setShowDataTable(p.config.showDataTable !== false);
        }
      })
      .finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => {
    if (!pageMeta) return;
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    apiFetch<ListResult>(`/api/runtime/${pageMeta.dataSourceId}/records?${params}`)
      .then((r) => setRecords(r.data))
      .catch(() => setRecords([]));
  }, [pageMeta]);

  const columns = pageMeta?.config.columns ?? [];

  const previewHtml = useMemo(() => {
    if (!pageMeta) return '';
    return renderReportPreview(bodyHtml, records, columns, {
      label: pageMeta.label,
      tableName: pageMeta.table ? `${pageMeta.schema}.${pageMeta.table}` : undefined,
      showDataTable,
    });
  }, [bodyHtml, records, columns, pageMeta, showDataTable]);

  const handleContentChange = useCallback((html: string) => {
    setBodyHtml(html);
    setDirty(true);
    setSavedMsg('');
  }, []);

  const save = async () => {
    if (!pageMeta) return;
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await apiFetch(`/api/generator/pages/${pageMeta.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          config: {
            ...pageMeta.config,
            bodyHtml,
            showDataTable,
            columns,
          },
        }),
      });
      setDirty(false);
      setSavedMsg('Relatório salvo.');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gabi-muted text-sm">Carregando relatório…</p>;
  if (!pageMeta) {
    return (
      <Alert variant="warning">
        Relatório não encontrado para o recurso <code>{resource}</code>.
      </Alert>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageMeta.label}
        description="Edite o conteúdo em modo visual e visualize com dados reais da tabela."
        actions={
          <>
            <Button
              type="button"
              variant={mode === 'edit' ? 'accent' : 'outline'}
              size="sm"
              onClick={() => setMode('edit')}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant={mode === 'preview' ? 'accent' : 'outline'}
              size="sm"
              onClick={() => setMode('preview')}
            >
              Visualizar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving || !dirty}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {savedMsg && (
        <Alert variant="info" className="mb-4">
          {savedMsg}
        </Alert>
      )}

      <Card padding="md" className="mb-4">
        <label className="flex items-center gap-2 text-sm text-gabi-primary cursor-pointer">
          <input
            type="checkbox"
            checked={showDataTable}
            onChange={(e) => {
              setShowDataTable(e.target.checked);
              setDirty(true);
              setSavedMsg('');
            }}
          />
          Incluir tabela de dados na visualização
        </label>
        <p className="text-xs text-gabi-muted mt-2 mb-0">
          {records.length} registro{records.length !== 1 ? 's' : ''} carregados para preview
          {records.length >= 100 ? ' (máx. 100)' : ''}.
        </p>
      </Card>

      {mode === 'edit' ? (
        <ReportEditor
          content={bodyHtml}
          onChange={handleContentChange}
          columns={columns}
        />
      ) : (
        <Card padding="lg" className="gabi-report-preview">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Card>
      )}
    </div>
  );
}
