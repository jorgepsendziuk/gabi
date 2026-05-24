import { useCallback, useMemo } from 'react';
import ReactGridLayout from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import type { DashboardPageConfig, DashboardWidget, DashboardWidgetType } from '@gabi/core';
import { newDashboardWidgetId } from '@gabi/core';
import { DashboardWidgetView } from './DashboardWidgetView';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const WIDGET_PALETTE: Array<{ type: DashboardWidgetType; label: string; desc: string }> = [
  { type: 'kpi', label: 'KPI', desc: 'Número / contagem' },
  { type: 'text', label: 'Texto', desc: 'HTML livre' },
  { type: 'table', label: 'Tabela', desc: 'Últimos registros' },
  { type: 'chart', label: 'Gráfico', desc: 'Barras simples' },
];

function defaultWidget(type: DashboardWidgetType, id: string): DashboardWidget {
  switch (type) {
    case 'kpi':
      return { id, type, title: 'Novo KPI', config: { metric: 'count' } };
    case 'text':
      return {
        id,
        type,
        title: 'Texto',
        config: { html: '<p>Edite o conteúdo no painel lateral.</p>' },
      };
    case 'table':
      return { id, type, title: 'Tabela', config: { maxRows: 6 } };
    case 'chart':
      return {
        id,
        type,
        title: 'Gráfico',
        config: { labels: ['Jan', 'Fev', 'Mar'], values: [10, 24, 18] },
      };
  }
}

interface DashboardGridEditorProps {
  config: DashboardPageConfig;
  dataSourceId: string;
  columns: Array<{ field: string; header: string }>;
  editing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (config: DashboardPageConfig) => void;
  width: number;
}

export function DashboardGridEditor({
  config,
  dataSourceId,
  columns,
  editing,
  selectedId,
  onSelect,
  onChange,
  width,
}: DashboardGridEditorProps) {
  const widgetMap = useMemo(
    () => new Map(config.widgets.map((w) => [w.id, w])),
    [config.widgets],
  );

  const layout: Layout = config.layout.map(
    (l): LayoutItem => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      minW: l.minW ?? 2,
      minH: l.minH ?? 2,
      static: !editing,
    }),
  );

  const handleLayoutChange = useCallback(
    (next: Layout) => {
      if (!editing) return;
      onChange({
        ...config,
        layout: next.map((l) => ({
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: l.minW,
          minH: l.minH,
        })),
      });
    },
    [config, editing, onChange],
  );

  const addWidget = (type: DashboardWidgetType) => {
    const id = newDashboardWidgetId();
    const widget = defaultWidget(type, id);
    const maxY = config.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    onChange({
      layout: [...config.layout, { i: id, x: 0, y: maxY, w: 4, h: 2, minW: 2, minH: 2 }],
      widgets: [...config.widgets, widget],
    });
    onSelect(id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    onChange({
      layout: config.layout.filter((l) => l.i !== selectedId),
      widgets: config.widgets.filter((w) => w.id !== selectedId),
    });
    onSelect(null);
  };

  const updateSelected = (patch: Partial<DashboardWidget>) => {
    if (!selectedId) return;
    onChange({
      ...config,
      widgets: config.widgets.map((w) =>
        w.id === selectedId ? { ...w, ...patch, config: { ...w.config, ...(patch.config ?? {}) } } : w,
      ),
    });
  };

  const selected = selectedId ? widgetMap.get(selectedId) : undefined;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {editing && (
        <aside className="lg:w-56 shrink-0 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gabi-muted uppercase tracking-wide mb-2">
              Adicionar widget
            </p>
            <div className="flex flex-col gap-1.5">
              {WIDGET_PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="gabi-btn gabi-btn--outline gabi-btn--sm text-left justify-start"
                  onClick={() => addWidget(item.type)}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-xs text-gabi-muted font-normal">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {selected && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <p className="text-xs font-semibold text-gabi-muted m-0">Widget selecionado</p>
              <label className="block text-xs text-gabi-muted">
                Título
                <input
                  className="gabi-input mt-1 w-full"
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                />
              </label>
              {selected.type === 'text' && (
                <label className="block text-xs text-gabi-muted">
                  HTML
                  <textarea
                    className="gabi-input mt-1 w-full font-mono text-xs min-h-[80px]"
                    value={typeof selected.config.html === 'string' ? selected.config.html : ''}
                    onChange={(e) =>
                      updateSelected({ config: { ...selected.config, html: e.target.value } })
                    }
                  />
                </label>
              )}
              {selected.type === 'kpi' && (
                <label className="block text-xs text-gabi-muted">
                  Valor fixo (opcional)
                  <input
                    className="gabi-input mt-1 w-full"
                    placeholder="Deixe vazio para contagem"
                    value={
                      selected.config.value != null ? String(selected.config.value) : ''
                    }
                    onChange={(e) =>
                      updateSelected({
                        config: {
                          ...selected.config,
                          value: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </label>
              )}
              {selected.type === 'table' && (
                <label className="block text-xs text-gabi-muted">
                  Linhas máx.
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="gabi-input mt-1 w-full"
                    value={
                      typeof selected.config.maxRows === 'number' ? selected.config.maxRows : 8
                    }
                    onChange={(e) =>
                      updateSelected({
                        config: {
                          ...selected.config,
                          maxRows: Number(e.target.value) || 8,
                        },
                      })
                    }
                  />
                </label>
              )}
              <button
                type="button"
                className="gabi-btn gabi-btn--outline gabi-btn--sm w-full text-red-600 border-red-200"
                onClick={removeSelected}
              >
                Remover widget
              </button>
            </div>
          )}
        </aside>
      )}

      <div className="flex-1 min-w-0">
        <ReactGridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={48}
          width={width}
          margin={[12, 12] as const}
          containerPadding={[0, 0] as const}
          isDraggable={editing}
          isResizable={editing}
          compactType="vertical"
          onLayoutChange={handleLayoutChange}
        >
          {config.widgets.map((widget) => (
            <div
              key={widget.id}
              className={`bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col h-full ${
                editing && selectedId === widget.id ? 'ring-2 ring-gabi-accent' : ''
              }`}
              onClick={() => editing && onSelect(widget.id)}
              role={editing ? 'button' : undefined}
              tabIndex={editing ? 0 : undefined}
            >
              <div className="px-3 py-2 border-b bg-slate-50 shrink-0">
                <h4 className="text-sm font-semibold m-0 truncate">{widget.title}</h4>
              </div>
              <div className="p-3 flex-1 min-h-0 overflow-hidden">
                <DashboardWidgetView
                  widget={widget}
                  dataSourceId={dataSourceId}
                  columns={columns}
                />
              </div>
            </div>
          ))}
        </ReactGridLayout>
      </div>
    </div>
  );
}
