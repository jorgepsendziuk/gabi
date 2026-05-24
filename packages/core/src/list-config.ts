import type { ListColumnConfig, ListFilterConfig, ListPageConfig } from './types.js';

type LegacyColumn = { field: string; header?: string; visible?: boolean };
type LegacyFilter = { field: string; label?: string; visible?: boolean };

/** Normaliza config de lista (compatível com páginas antigas). */
export function normalizeListPageConfig(config: Record<string, unknown>): ListPageConfig {
  const rawColumns = (config.columns ?? []) as LegacyColumn[];
  const rawFilters = (config.filters ?? []) as LegacyFilter[];

  const columns: ListColumnConfig[] = rawColumns.map((c) => ({
    field: c.field,
    header: c.header ?? c.field,
    visible: c.visible !== false,
  }));

  const filterFields = new Set<string>();
  const filters: ListFilterConfig[] = [];

  for (const f of rawFilters) {
    if (!f.field || filterFields.has(f.field)) continue;
    filterFields.add(f.field);
    filters.push({
      field: f.field,
      label: f.label ?? f.field,
      visible: f.visible !== false,
    });
  }

  if (filters.length === 0) {
    for (const c of columns) {
      if (filterFields.has(c.field)) continue;
      filterFields.add(c.field);
      filters.push({ field: c.field, label: c.header, visible: true });
    }
  }

  return {
    columns,
    filters,
    geometryColumn: typeof config.geometryColumn === 'string' ? config.geometryColumn : undefined,
  };
}

export function visibleListColumns(config: ListPageConfig): ListColumnConfig[] {
  return config.columns.filter((c) => c.visible);
}

export function visibleListFilters(config: ListPageConfig): ListFilterConfig[] {
  return config.filters.filter((f) => f.visible);
}
