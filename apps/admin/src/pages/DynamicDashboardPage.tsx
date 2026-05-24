import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { normalizeDashboardPageConfig, type DashboardPageConfig } from '@gabi/core';
import { Alert, Button, PageHeader } from '@gabi/ui';
import { DashboardGridEditor } from '../components/DashboardGridEditor';
import { apiFetch } from '../lib/api';

interface PageMeta {
  id: string;
  dataSourceId: string;
  label: string;
  config: Record<string, unknown>;
  schema?: string;
  table?: string;
}

type ViewMode = 'view' | 'edit';

export function DynamicDashboardPage() {
  const { resource } = useParams<{ resource: string }>();
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [dashConfig, setDashConfig] = useState<DashboardPageConfig | null>(null);
  const [columns, setColumns] = useState<Array<{ field: string; header: string }>>([]);
  const [mode, setMode] = useState<ViewMode>('view');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [gridWidth, setGridWidth] = useState(900);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<
      Array<{
        id: string;
        type: string;
        resource: string;
        dataSourceId: string;
        label: string;
        config: Record<string, unknown>;
        schema?: string;
        table?: string;
      }>
    >('/api/generator/pages')
      .then((pages) => {
        const p = pages.find((x) => x.resource === resource && x.type === 'dashboard');
        if (p) {
          setPageMeta({
            id: p.id,
            dataSourceId: p.dataSourceId,
            label: p.label,
            config: p.config,
            schema: p.schema,
            table: p.table,
          });
          setDashConfig(normalizeDashboardPageConfig(p.config));
        }
      })
      .finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => {
    if (!pageMeta) return;
    apiFetch<{
      columns: Array<{ name: string }>;
    }>(`/api/generator/data-sources/${pageMeta.dataSourceId}`)
      .then((ds) => {
        setColumns(
          ds.columns
            .filter((c) => c.name !== 'geom' && !c.name.startsWith('__'))
            .slice(0, 12)
            .map((c) => ({ field: c.name, header: c.name })),
        );
      })
      .catch(() => setColumns([]));
  }, [pageMeta]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setGridWidth(Math.floor(w));
    });
    ro.observe(el);
    setGridWidth(el.clientWidth || 900);
    return () => ro.disconnect();
  }, [mode, loading]);

  const handleConfigChange = useCallback((next: DashboardPageConfig) => {
    setDashConfig(next);
    setDirty(true);
    setSavedMsg('');
  }, []);

  const save = async () => {
    if (!pageMeta || !dashConfig) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/generator/pages/${pageMeta.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          config: dashConfig as unknown as Record<string, unknown>,
        }),
      });
      setDirty(false);
      setSavedMsg('Dashboard salvo.');
      setMode('view');
      setSelectedId(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gabi-muted">Carregando dashboard…</p>;
  }

  if (!pageMeta || !dashConfig) {
    return (
      <Alert variant="danger">
        Dashboard não encontrado para o resource <code>{resource}</code>.
      </Alert>
    );
  }

  const editing = mode === 'edit';

  return (
    <div>
      <PageHeader
        title={pageMeta.label}
        description={
          pageMeta.schema && pageMeta.table
            ? `Fonte: ${pageMeta.schema}.${pageMeta.table}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {savedMsg && <span className="text-sm text-green-700">{savedMsg}</span>}
            {dirty && editing && (
              <span className="text-sm text-amber-600">Alterações não salvas</span>
            )}
            {editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDashConfig(normalizeDashboardPageConfig(pageMeta.config));
                    setMode('view');
                    setSelectedId(null);
                    setDirty(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button variant="accent" disabled={saving || !dirty} onClick={() => void save()}>
                  {saving ? 'Salvando…' : 'Salvar layout'}
                </Button>
              </>
            ) : (
              <Button variant="accent" onClick={() => setMode('edit')}>
                Editar (arrastar widgets)
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {editing && (
        <p className="text-sm text-gabi-muted mb-4">
          Arraste e redimensione os widgets. Use o painel à esquerda para adicionar KPI, texto,
          tabela ou gráfico.
        </p>
      )}

      <div ref={containerRef} className="w-full">
        <DashboardGridEditor
          config={dashConfig}
          dataSourceId={pageMeta.dataSourceId}
          columns={columns}
          editing={editing}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={handleConfigChange}
          width={gridWidth}
        />
      </div>
    </div>
  );
}
