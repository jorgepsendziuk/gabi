import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  normalizeListPageConfig,
  visibleListColumns,
  visibleListFilters,
  type ListPageConfig,
} from '@gabi/core';
import { Alert, Button, DataGridPro, PageHeader } from '@gabi/ui';
import type { DataGridColumn } from '@gabi/ui';
import { apiFetch, getToken } from '../lib/api';
import { ListConfigEditor } from '../components/ListConfigEditor';
import { ListRowActions } from '../components/ListRowActions';
import { ReportPickerModal, type ReportOption } from '../components/ReportPickerModal';
import { recordReportPath } from '../lib/dynamicPaths';

interface PageMeta {
  id: string;
  resource: string;
  dataSourceId: string;
  label: string;
  config: Record<string, unknown>;
}

interface ListResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

type ViewMode = 'data' | 'config';

function getField(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const key = Object.keys(row).find((k) => k.toLowerCase() === field.toLowerCase());
  return key ? row[key] : undefined;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  }
  return String(value);
}

function buildListParams(opts: {
  page: number;
  pageSize: number;
  search: string;
  filterValues: Record<string, string>;
}): URLSearchParams {
  const params = new URLSearchParams({
    page: String(opts.page),
    pageSize: String(opts.pageSize),
  });
  if (opts.search.trim()) params.set('search', opts.search.trim());
  for (const [key, value] of Object.entries(opts.filterValues)) {
    if (value.trim()) params.set(`filters[${key}]`, value.trim());
  }
  return params;
}

interface DataSourceMeta {
  recordKeyColumn?: string;
  odkReadOnly: boolean;
  reports: ReportOption[];
}

export function DynamicListPage() {
  const { resource } = useParams<{ resource: string }>();
  const navigate = useNavigate();
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [listConfig, setListConfig] = useState<ListPageConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<ListPageConfig | null>(null);
  const [result, setResult] = useState<ListResult | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [mode, setMode] = useState<ViewMode>('data');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [dsMeta, setDsMeta] = useState<DataSourceMeta | null>(null);
  const [reportPicker, setReportPicker] = useState<{
    recordId: string;
    reports: ReportOption[];
  } | null>(null);

  useEffect(() => {
    apiFetch<
      Array<{
        id: string;
        type: string;
        resource: string;
        dataSourceId: string;
        label: string;
        config: Record<string, unknown>;
      }>
    >('/api/generator/pages')
      .then((pages) => {
        const p = pages.find((x) => x.resource === resource && x.type === 'list');
        if (!p) return;
        const normalized = normalizeListPageConfig(p.config);
        setPageMeta({
          id: p.id,
          resource: p.resource,
          dataSourceId: p.dataSourceId,
          label: p.label,
          config: p.config,
        });
        setListConfig(normalized);
        setDraftConfig(normalized);

        apiFetch<DataSourceMeta>(`/api/generator/data-sources/${p.dataSourceId}`)
          .then((meta) =>
            setDsMeta({
              recordKeyColumn: meta.recordKeyColumn,
              odkReadOnly: meta.odkReadOnly,
              reports: meta.reports,
            }),
          )
          .catch(() => setDsMeta({ odkReadOnly: false, reports: [] }));
      })
      .finally(() => setLoading(false));
  }, [resource]);

  const activeConfig = listConfig ?? { columns: [], filters: [] };
  const visibleColumns = useMemo(() => visibleListColumns(activeConfig), [activeConfig]);
  const visibleFilters = useMemo(() => visibleListFilters(activeConfig), [activeConfig]);

  const loadRecords = useCallback(() => {
    if (!pageMeta) return;
    setLoading(true);
    const params = buildListParams({ page, pageSize: 25, search, filterValues });
    apiFetch<ListResult>(`/api/runtime/${pageMeta.dataSourceId}/records?${params}`)
      .then(setResult)
      .catch(() => setResult({ data: [], total: 0, page: 1, pageSize: 25 }))
      .finally(() => setLoading(false));
  }, [pageMeta, page, search, filterValues]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleFilterChange = (field: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleFiltersClear = () => {
    setFilterValues({});
    setPage(1);
  };

  const saveConfig = async () => {
    if (!pageMeta || !draftConfig) return;
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await apiFetch(`/api/generator/pages/${pageMeta.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          config: {
            ...pageMeta.config,
            columns: draftConfig.columns,
            filters: draftConfig.filters,
            geometryColumn: draftConfig.geometryColumn,
          },
        }),
      });
      setListConfig(draftConfig);
      setPageMeta((m) =>
        m
          ? {
              ...m,
              config: {
                ...m.config,
                columns: draftConfig.columns,
                filters: draftConfig.filters,
              },
            }
          : m,
      );
      setDirty(false);
      setSavedMsg('Configuração salva.');
      setMode('data');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!pageMeta) return;
    setExportLoading(true);
    setError('');
    try {
      const token = getToken();
      const params = buildListParams({ page: 1, pageSize: 25, search, filterValues });
      const colFields = visibleColumns.map((c) => c.field);
      if (colFields.length > 0) params.set('columns', colFields.join(','));

      const res = await fetch(
        `/api/runtime/${pageMeta.dataSourceId}/export.csv?${params}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `Exportação falhou (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pageMeta.resource}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setExportLoading(false);
    }
  };

  if (loading && !pageMeta) {
    return <p className="text-gabi-muted text-sm">Carregando lista…</p>;
  }

  if (!pageMeta || !listConfig) {
    return (
      <Alert variant="warning">
        Lista não encontrada para o recurso <code>{resource}</code>.
      </Alert>
    );
  }

  const gridColumns: DataGridColumn<Record<string, unknown>>[] = visibleColumns.map((c) => ({
    id: c.field,
    header: c.header,
    cell: (row: Record<string, unknown>) => formatCell(getField(row, c.field)),
  }));

  const displayColumns = gridColumns.filter((c) => c.id !== '_gabi');

  return (
    <div>
      <PageHeader
        title={pageMeta.label}
        description="Listagem com busca, filtros por coluna e exportação CSV."
        actions={
          <>
            <Button
              type="button"
              variant={mode === 'data' ? 'accent' : 'outline'}
              size="sm"
              onClick={() => setMode('data')}
            >
              Dados
            </Button>
            <Button
              type="button"
              variant={mode === 'config' ? 'accent' : 'outline'}
              size="sm"
              onClick={() => {
                setDraftConfig(listConfig);
                setMode('config');
              }}
            >
              Configurar
            </Button>
            {mode === 'config' && dirty && (
              <Button type="button" variant="accent" size="sm" disabled={saving} onClick={saveConfig}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {savedMsg && (
        <Alert variant="success" className="mb-4">
          {savedMsg}
        </Alert>
      )}

      {mode === 'config' && draftConfig ? (
        <ListConfigEditor
          columns={draftConfig.columns}
          filters={draftConfig.filters}
          disabled={saving}
          onColumnsChange={(columns) => {
            setDraftConfig((c) => (c ? { ...c, columns } : c));
            setDirty(true);
            setSavedMsg('');
          }}
          onFiltersChange={(filters) => {
            setDraftConfig((c) => (c ? { ...c, filters } : c));
            setDirty(true);
            setSavedMsg('');
          }}
        />
      ) : (
        <DataGridPro
          columns={[
            ...displayColumns,
            {
              id: '_gabi_status',
              header: 'Status',
              cell: (row) => {
                const g = row._gabi as
                  | { hasLocalChanges?: boolean; isCreatedLocally?: boolean; isDeletedLocally?: boolean }
                  | undefined;
                if (!g?.hasLocalChanges) return <span className="text-slate-400">original</span>;
                if (g.isCreatedLocally) return <span className="text-green-700 font-medium">novo (GABI)</span>;
                if (g.isDeletedLocally) return <span className="text-red-600 font-medium">excluído (GABI)</span>;
                return <span className="text-amber-700 font-medium">alterado (GABI)</span>;
              },
            },
          ]}
          data={result?.data ?? []}
          total={result?.total ?? 0}
          page={page}
          pageSize={25}
          loading={loading}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          filters={visibleFilters.map((f) => ({ field: f.field, label: f.label }))}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onFiltersClear={handleFiltersClear}
          onPageChange={setPage}
          onExport={handleExport}
          exportLoading={exportLoading}
          renderRowActions={(row) => (
            <ListRowActions
              listResource={pageMeta.resource}
              row={row}
              recordKeyColumn={dsMeta?.recordKeyColumn}
              odkReadOnly={dsMeta?.odkReadOnly}
              reports={dsMeta?.reports ?? []}
              onReportClick={(recordId, reports) => setReportPicker({ recordId, reports })}
            />
          )}
        />
      )}

      {reportPicker && resource && (
        <ReportPickerModal
          reports={reportPicker.reports}
          onClose={() => setReportPicker(null)}
          onSelect={(reportResource) => {
            navigate(recordReportPath(resource, reportPicker.recordId, reportResource));
            setReportPicker(null);
          }}
        />
      )}
    </div>
  );
}
