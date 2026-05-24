import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, PageHeader } from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { renderReportPreview } from '../lib/reportRender';

interface ReportPageMeta {
  label: string;
  config: {
    columns?: Array<{ field: string; header: string }>;
    bodyHtml?: string;
    showDataTable?: boolean;
  };
  schema?: string;
  table?: string;
}

export function DynamicRecordReportPage() {
  const { resource, recordId, reportResource } = useParams<{
    resource: string;
    recordId: string;
    reportResource: string;
  }>();
  const [listLabel, setListLabel] = useState('');
  const [reportMeta, setReportMeta] = useState<ReportPageMeta | null>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resource || !recordId || !reportResource) return;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const pages = await apiFetch<
          Array<{
            resource: string;
            type: string;
            dataSourceId: string;
            label: string;
            config: ReportPageMeta['config'];
            schema?: string;
            table?: string;
          }>
        >('/api/generator/pages');

        const listPage = pages.find((p) => p.resource === resource && p.type === 'list');
        const reportPage = pages.find(
          (p) => p.resource === reportResource && p.type === 'report',
        );

        if (!listPage) {
          setError('Lista não encontrada.');
          return;
        }
        if (!reportPage) {
          setError('Relatório não encontrado.');
          return;
        }
        if (listPage.dataSourceId !== reportPage.dataSourceId) {
          setError('Este relatório não está vinculado à mesma fonte de dados da lista.');
          return;
        }

        setListLabel(listPage.label);
        setReportMeta({
          label: reportPage.label,
          config: reportPage.config,
          schema: reportPage.schema,
          table: reportPage.table,
        });

        const row = await apiFetch<Record<string, unknown>>(
          `/api/runtime/${listPage.dataSourceId}/records/${recordId}`,
        );
        setRecord(row);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [resource, recordId, reportResource]);

  const previewHtml = useMemo(() => {
    if (!reportMeta || !record) return '';
    const columns = reportMeta.config.columns ?? [];
    return renderReportPreview(
      reportMeta.config.bodyHtml ?? '<p></p>',
      [record],
      columns,
      {
        label: reportMeta.label,
        tableName: reportMeta.table ? `${reportMeta.schema}.${reportMeta.table}` : undefined,
        showDataTable: false,
      },
    );
  }, [reportMeta, record]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <p className="text-gabi-muted text-sm">Gerando relatório…</p>;

  if (error || !reportMeta || !record || !resource || !recordId) {
    return (
      <Alert variant="warning">
        {error || 'Não foi possível gerar o relatório.'}
        <div className="mt-3">
          <Link to={`/p/${resource}/list`} className="gabi-btn gabi-btn--outline gabi-btn--sm">
            Voltar à lista
          </Link>
        </div>
      </Alert>
    );
  }

  return (
    <div>
      <PageHeader
        title={reportMeta.label}
        description={`Relatório do registro · ${listLabel}`}
        actions={
          <>
            <Link
              to={`/p/${resource}/record/${recordId}`}
              className="gabi-btn gabi-btn--outline gabi-btn--sm"
            >
              Ver registro
            </Link>
            <Link to={`/p/${resource}/list`} className="gabi-btn gabi-btn--outline gabi-btn--sm">
              Lista
            </Link>
            <Button type="button" variant="accent" size="sm" onClick={handlePrint}>
              Imprimir
            </Button>
          </>
        }
      />

      <Card padding="lg" className="gabi-report-preview">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </Card>
    </div>
  );
}
