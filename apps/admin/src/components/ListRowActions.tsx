import { Link, useNavigate } from 'react-router-dom';
import { recordEditPath, recordReportPath, recordViewPath } from '../lib/dynamicPaths';
import { rowToRecordId } from '../lib/recordKey';
import type { ReportOption } from './ReportPickerModal';

interface ListRowActionsProps {
  listResource: string;
  row: Record<string, unknown>;
  recordKeyColumn?: string;
  odkReadOnly?: boolean;
  reports: ReportOption[];
  onReportClick: (recordId: string, reports: ReportOption[]) => void;
}

export function ListRowActions({
  listResource,
  row,
  recordKeyColumn,
  odkReadOnly,
  reports,
  onReportClick,
}: ListRowActionsProps) {
  const navigate = useNavigate();
  const recordId = rowToRecordId(row, recordKeyColumn);
  if (!recordId) {
    return <span className="text-xs text-gabi-muted">—</span>;
  }

  const btnClass = 'gabi-btn gabi-btn--sm gabi-btn--outline whitespace-nowrap';

  return (
    <>
      <Link to={recordViewPath(listResource, recordId)} className={btnClass} title="Visualizar">
        Ver
      </Link>
      {odkReadOnly && (
        <Link to={recordEditPath(listResource, recordId)} className={btnClass} title="Editar">
          Editar
        </Link>
      )}
      {reports.length > 0 && (
        <button
          type="button"
          className={btnClass}
          title="Gerar relatório"
          onClick={() => {
            if (reports.length === 1) {
              navigate(recordReportPath(listResource, recordId, reports[0]!.resource));
            } else {
              onReportClick(recordId, reports);
            }
          }}
        >
          Relatório
        </button>
      )}
    </>
  );
}
