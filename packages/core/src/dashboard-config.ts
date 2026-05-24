import type { DashboardPageConfig, DashboardWidget, DashboardWidgetLayout } from './types.js';

const DEFAULT_LAYOUT: DashboardWidgetLayout[] = [
  { i: 'kpi-total', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'text-welcome', x: 3, y: 0, w: 5, h: 2, minW: 2, minH: 2 },
  { i: 'table-recent', x: 0, y: 2, w: 8, h: 4, minW: 4, minH: 3 },
];

const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'kpi-total',
    type: 'kpi',
    title: 'Total de registros',
    config: { metric: 'count' },
  },
  {
    id: 'text-welcome',
    type: 'text',
    title: 'Bem-vindo',
    config: {
      html: '<p>Arraste e redimensione os widgets para montar seu painel.</p>',
    },
  },
  {
    id: 'table-recent',
    type: 'table',
    title: 'Últimos registros',
    config: { maxRows: 8 },
  },
];

export function buildDefaultDashboardPageConfig(): DashboardPageConfig {
  return {
    layout: DEFAULT_LAYOUT.map((l) => ({ ...l })),
    widgets: DEFAULT_WIDGETS.map((w) => ({ ...w, config: { ...w.config } })),
  };
}

function parseLayoutItem(raw: unknown): DashboardWidgetLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const i = typeof o.i === 'string' ? o.i : null;
  if (!i) return null;
  return {
    i,
    x: typeof o.x === 'number' ? o.x : 0,
    y: typeof o.y === 'number' ? o.y : 0,
    w: typeof o.w === 'number' ? o.w : 4,
    h: typeof o.h === 'number' ? o.h : 2,
    minW: typeof o.minW === 'number' ? o.minW : undefined,
    minH: typeof o.minH === 'number' ? o.minH : undefined,
  };
}

function parseWidget(raw: unknown): DashboardWidget | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : null;
  const type = o.type;
  if (!id || (type !== 'kpi' && type !== 'text' && type !== 'table' && type !== 'chart')) {
    return null;
  }
  return {
    id,
    type,
    title: typeof o.title === 'string' ? o.title : 'Widget',
    config:
      o.config && typeof o.config === 'object' && !Array.isArray(o.config)
        ? (o.config as Record<string, unknown>)
        : {},
  };
}

export function normalizeDashboardPageConfig(
  config: Record<string, unknown>,
): DashboardPageConfig {
  const defaults = buildDefaultDashboardPageConfig();
  const layoutRaw = Array.isArray(config.layout) ? config.layout : [];
  const widgetsRaw = Array.isArray(config.widgets) ? config.widgets : [];

  const layout = layoutRaw
    .map(parseLayoutItem)
    .filter((l): l is DashboardWidgetLayout => l !== null);
  const widgets = widgetsRaw
    .map(parseWidget)
    .filter((w): w is DashboardWidget => w !== null);

  if (layout.length === 0 && widgets.length === 0) {
    return defaults;
  }

  const widgetIds = new Set(widgets.map((w) => w.id));
  const syncedLayout = layout.filter((l) => widgetIds.has(l.i));

  for (const w of widgets) {
    if (!syncedLayout.some((l) => l.i === w.id)) {
      const maxY = syncedLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      syncedLayout.push({ i: w.id, x: 0, y: maxY, w: 4, h: 2, minW: 2, minH: 2 });
    }
  }

  return {
    layout: syncedLayout.length > 0 ? syncedLayout : defaults.layout,
    widgets: widgets.length > 0 ? widgets : defaults.widgets,
  };
}

export function newDashboardWidgetId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
