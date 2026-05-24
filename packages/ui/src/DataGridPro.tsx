import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useMemo } from 'react';

export interface DataGridColumn<T> {
  id: string;
  header: string;
  accessorKey?: keyof T & string;
  cell?: (row: T) => React.ReactNode;
}

export interface DataGridFilterField {
  field: string;
  label: string;
}

export interface DataGridProProps<T extends Record<string, unknown>> {
  columns: DataGridColumn<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  filters?: DataGridFilterField[];
  filterValues?: Record<string, string>;
  onFilterChange?: (field: string, value: string) => void;
  onFiltersClear?: () => void;
  onPageChange?: (page: number) => void;
  onExport?: () => void | Promise<void>;
  exportLoading?: boolean;
  /** Coluna de ações por linha (ex.: visualizar, editar). */
  renderRowActions?: (row: T) => React.ReactNode;
  actionsHeader?: string;
}

export function DataGridPro<T extends Record<string, unknown>>({
  columns,
  data,
  total,
  page,
  pageSize,
  loading,
  search,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  onFiltersClear,
  onPageChange,
  onExport,
  exportLoading,
  renderRowActions,
  actionsHeader = 'Ações',
}: DataGridProProps<T>) {
  const defs = useMemo<ColumnDef<T>[]>(() => {
    const base = columns.map((col) => ({
      id: col.id,
      header: col.header,
      accessorKey: col.accessorKey,
      cell: col.cell ? (info: { row: { original: T } }) => col.cell!(info.row.original) : undefined,
    }));
    if (!renderRowActions) return base;
    return [
      ...base,
      {
        id: '_actions',
        header: actionsHeader,
        cell: (info: { row: { original: T } }) => (
          <div className="gabi-datagrid-actions flex flex-wrap gap-1">{renderRowActions(info.row.original)}</div>
        ),
      },
    ];
  }, [columns, renderRowActions, actionsHeader]);

  const table = useReactTable({
    data,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(total / pageSize) || 1;
  const hasActiveFilters = Boolean(
    filterValues && Object.values(filterValues).some((v) => v.trim() !== ''),
  );

  return (
    <div className="gabi-datagrid-wrapper">
      <div className="gabi-datagrid-toolbar">
        {onSearchChange && (
          <input
            type="search"
            placeholder="Buscar..."
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {onExport && (
          <button type="button" onClick={() => void onExport()} disabled={exportLoading}>
            {exportLoading ? 'Exportando…' : 'Exportar CSV'}
          </button>
        )}
      </div>

      {filters && filters.length > 0 && onFilterChange && (
        <div className="gabi-datagrid-filters border border-[var(--gabi-border)] rounded-lg p-3 mb-3 bg-slate-50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-gabi-muted uppercase tracking-wide">
              Filtros por coluna
            </span>
            {hasActiveFilters && onFiltersClear && (
              <button type="button" className="text-xs text-gabi-accent" onClick={onFiltersClear}>
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filters.map((f) => (
              <label key={f.field} className="flex flex-col gap-0.5 text-xs">
                <span className="text-gabi-muted truncate" title={f.field}>
                  {f.label}
                </span>
                <input
                  type="text"
                  className="text-sm"
                  placeholder="Filtrar…"
                  value={filterValues?.[f.field] ?? ''}
                  onChange={(e) => onFilterChange(f.field, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="gabi-loading">Carregando...</div>
      ) : (
        <table className="gabi-datagrid">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center text-gabi-muted py-8">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <div className="gabi-pagination">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
          Anterior
        </button>
        <span>
          Página {page} de {totalPages} ({total} registros)
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
