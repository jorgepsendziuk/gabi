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

export interface DataGridProProps<T extends Record<string, unknown>> {
  columns: DataGridColumn<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  onPageChange?: (page: number) => void;
  onExport?: () => void;
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
  onPageChange,
  onExport,
}: DataGridProProps<T>) {
  const defs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        header: col.header,
        accessorKey: col.accessorKey,
        cell: col.cell
          ? (info) => col.cell!(info.row.original)
          : undefined,
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

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
          <button type="button" onClick={onExport}>
            Exportar CSV
          </button>
        )}
      </div>

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
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
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
