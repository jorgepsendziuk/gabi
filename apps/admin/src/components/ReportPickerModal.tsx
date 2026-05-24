import { Button, Card } from '@gabi/ui';

export interface ReportOption {
  resource: string;
  label: string;
}

interface ReportPickerModalProps {
  reports: ReportOption[];
  onSelect: (reportResource: string) => void;
  onClose: () => void;
}

export function ReportPickerModal({ reports, onSelect, onClose }: ReportPickerModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-picker-title"
    >
      <Card padding="lg" className="w-full max-w-md">
        <h2 id="report-picker-title" className="text-lg font-semibold m-0 mb-2">
          Escolher relatório
        </h2>
        <p className="text-sm text-gabi-muted mt-0 mb-4">
          Há {reports.length} relatório{reports.length !== 1 ? 's' : ''} vinculado
          {reports.length !== 1 ? 's' : ''} a esta fonte de dados.
        </p>
        <ul className="space-y-2 m-0 p-0 list-none mb-4">
          {reports.map((r) => (
            <li key={r.resource}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg border border-[var(--gabi-border)] hover:bg-slate-50 text-sm"
                onClick={() => onSelect(r.resource)}
              >
                {r.label}
                <span className="block font-mono text-xs text-gabi-muted mt-0.5">{r.resource}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </Card>
    </div>
  );
}
