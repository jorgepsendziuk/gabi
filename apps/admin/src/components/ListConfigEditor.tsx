import type { ListColumnConfig, ListFilterConfig } from '@gabi/core';
import { Button, Card } from '@gabi/ui';

interface ListConfigEditorProps {
  columns: ListColumnConfig[];
  filters: ListFilterConfig[];
  onColumnsChange: (columns: ListColumnConfig[]) => void;
  onFiltersChange: (filters: ListFilterConfig[]) => void;
  disabled?: boolean;
}

function toggleVisible<T extends { visible: boolean }>(items: T[], index: number): T[] {
  return items.map((item, i) => (i === index ? { ...item, visible: !item.visible } : item));
}

export function ListConfigEditor({
  columns,
  filters,
  onColumnsChange,
  onFiltersChange,
  disabled,
}: ListConfigEditorProps) {
  const visibleColCount = columns.filter((c) => c.visible).length;
  const visibleFilterCount = filters.filter((f) => f.visible).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card padding="md">
        <h3 className="text-sm font-semibold m-0 mb-1">Colunas da tabela</h3>
        <p className="text-xs text-gabi-muted mt-0 mb-3">
          {visibleColCount} de {columns.length} visíveis na grade
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onColumnsChange(columns.map((c) => ({ ...c, visible: true })))}
          >
            Todas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onColumnsChange(columns.map((c) => ({ ...c, visible: false })))}
          >
            Nenhuma
          </Button>
        </div>
        <ul className="max-h-64 overflow-y-auto space-y-1.5 m-0 p-0 list-none">
          {columns.map((col, i) => (
            <li key={col.field}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.visible}
                  disabled={disabled}
                  onChange={() => onColumnsChange(toggleVisible(columns, i))}
                />
                <span className="font-mono text-xs">{col.field}</span>
                {col.header !== col.field && (
                  <span className="text-gabi-muted text-xs">({col.header})</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold m-0 mb-1">Filtros</h3>
        <p className="text-xs text-gabi-muted mt-0 mb-3">
          {visibleFilterCount} de {filters.length} exibidos na barra de filtros
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onFiltersChange(filters.map((f) => ({ ...f, visible: true })))}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onFiltersChange(filters.map((f) => ({ ...f, visible: false })))}
          >
            Nenhum
          </Button>
        </div>
        <ul className="max-h-64 overflow-y-auto space-y-1.5 m-0 p-0 list-none">
          {filters.map((f, i) => (
            <li key={f.field}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.visible}
                  disabled={disabled}
                  onChange={() => onFiltersChange(toggleVisible(filters, i))}
                />
                <span className="font-mono text-xs">{f.field}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
