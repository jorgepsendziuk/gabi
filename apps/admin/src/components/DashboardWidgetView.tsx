import { useEffect, useState } from 'react';
import type { DashboardWidget } from '@gabi/core';
import { apiFetch } from '../lib/api';

interface ListResult {
  data: Record<string, unknown>[];
  total: number;
}

interface DashboardWidgetViewProps {
  widget: DashboardWidget;
  dataSourceId: string;
  columns: Array<{ field: string; header: string }>;
}

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function SimpleBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-2 h-full min-h-[120px] pt-2">
      {labels.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t bg-gabi-accent/80 transition-all"
            style={{ height: `${Math.max(8, (values[i]! / max) * 100)}%`, minHeight: 8 }}
            title={`${label}: ${values[i]}`}
          />
          <span className="text-[10px] text-gabi-muted truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardWidgetView({
  widget,
  dataSourceId,
  columns,
}: DashboardWidgetViewProps) {
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const maxRows =
    typeof widget.config.maxRows === 'number' ? widget.config.maxRows : 8;
  const metric = widget.config.metric === 'count' ? 'count' : 'count';
  const staticValue =
    typeof widget.config.value === 'string' || typeof widget.config.value === 'number'
      ? String(widget.config.value)
      : null;

  const chartLabels = Array.isArray(widget.config.labels)
    ? (widget.config.labels as unknown[]).map(String)
    : ['A', 'B', 'C'];
  const chartValues = Array.isArray(widget.config.values)
    ? (widget.config.values as unknown[]).map((v) => Number(v) || 0)
    : [12, 28, 9];

  useEffect(() => {
    if (widget.type === 'text') return;
    if (widget.type === 'chart' && staticValue) return;

    setLoading(true);
    const pageSize = widget.type === 'kpi' ? '1' : String(maxRows);
    const params = new URLSearchParams({ page: '1', pageSize });
    apiFetch<ListResult>(`/api/runtime/${dataSourceId}/records?${params}`)
      .then((r) => {
        if (widget.type === 'kpi' && metric === 'count') {
          setTotal(r.total);
        }
        if (widget.type === 'table') {
          setRows(r.data);
        }
      })
      .catch(() => {
        setTotal(null);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [widget.type, widget.config, dataSourceId, maxRows, metric, staticValue]);

  if (widget.type === 'text') {
    const html =
      typeof widget.config.html === 'string'
        ? widget.config.html
        : '<p>Texto do widget</p>';
    return (
      <div
        className="prose prose-sm max-w-none text-gabi-primary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (widget.type === 'kpi') {
    const display = staticValue ?? (loading ? '…' : total != null ? total.toLocaleString('pt-BR') : '—');
    const subtitle =
      typeof widget.config.subtitle === 'string' ? widget.config.subtitle : undefined;
    return (
      <div className="flex flex-col justify-center h-full">
        <p className="text-3xl font-bold text-gabi-accent m-0 tabular-nums">{display}</p>
        {subtitle && <p className="text-sm text-gabi-muted mt-1 mb-0">{subtitle}</p>}
      </div>
    );
  }

  if (widget.type === 'chart') {
    return <SimpleBarChart labels={chartLabels} values={chartValues} />;
  }

  const visibleCols = columns.slice(0, 5);
  if (visibleCols.length === 0) {
    return <p className="text-sm text-gabi-muted m-0">Sem colunas configuradas na fonte.</p>;
  }

  return (
    <div className="overflow-auto h-full -mx-1">
      {loading ? (
        <p className="text-sm text-gabi-muted m-0">Carregando…</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gabi-muted">
              {visibleCols.map((c) => (
                <th key={c.field} className="py-1.5 px-2 font-medium">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="py-3 px-2 text-gabi-muted">
                  Nenhum registro
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  {visibleCols.map((c) => (
                    <td key={c.field} className="py-1.5 px-2 truncate max-w-[140px]">
                      {formatCell(row[c.field])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
