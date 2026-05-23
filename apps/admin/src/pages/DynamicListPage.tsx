import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DataGridPro } from '@gabi/ui';
import type { DataGridColumn } from '@gabi/ui';
import { apiFetch, getToken } from '../lib/api';

interface PageMeta {
  dataSourceId: string;
  label: string;
  config: { columns?: Array<{ field: string; header: string }> };
}

interface ListResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export function DynamicListPage() {
  const { resource } = useParams<{ resource: string }>();
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [result, setResult] = useState<ListResult | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Array<{ resource: string; dataSourceId: string; label: string; config: PageMeta['config'] }>>(
      '/api/generator/pages',
    ).then((pages) => {
      const p = pages.find((x) => x.resource === resource);
      if (p) setPageMeta({ dataSourceId: p.dataSourceId, label: p.label, config: p.config });
    });
  }, [resource]);

  useEffect(() => {
    if (!pageMeta) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      ...(search ? { search } : {}),
    });
    apiFetch<ListResult>(`/api/runtime/${pageMeta.dataSourceId}/records?${params}`)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [pageMeta, page, search]);

  if (!pageMeta) return <p>Carregando...</p>;

  const columns: DataGridColumn<Record<string, unknown>>[] = (
    pageMeta.config.columns ?? Object.keys(result?.data[0] ?? {}).slice(0, 8).map((k) => ({
      field: k,
      header: k,
    }))
  ).map((c) => ({
    id: c.field,
    header: c.header,
    accessorKey: c.field as keyof Record<string, unknown>,
    cell: c.field === '_gabi' ? undefined : undefined,
  }));

  const displayColumns = columns.filter((c) => c.id !== '_gabi');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{pageMeta.label}</h2>
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
        onPageChange={setPage}
        onExport={async () => {
          const token = getToken();
          const params = new URLSearchParams(search ? { search } : {});
          const res = await fetch(
            `/api/runtime/${pageMeta.dataSourceId}/export.csv?${params}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
          );
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${pageMeta.dataSourceId}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      />
    </div>
  );
}
