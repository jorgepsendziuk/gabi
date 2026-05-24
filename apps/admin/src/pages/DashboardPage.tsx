import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Card, PageHeader } from '@gabi/ui';

interface Page {
  id: string;
  type: string;
  resource: string;
  label: string;
  dataSourceId: string;
}

export function DashboardPage() {
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    apiFetch<Page[]>('/api/generator/pages').then(setPages).catch(() => setPages([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Painel GABI"
        description="Framework mínimo para ERPs geoespaciais. Conecte ao banco, introspecte tabelas e gere listagens, mapas e relatórios."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link to="/introspect" className="no-underline text-inherit">
          <Card hover padding="lg">
            <h3 className="font-semibold text-gabi-accent m-0">1. Introspectar</h3>
            <p className="text-sm text-gabi-muted mt-1 mb-0">
              Listar tabelas e capacidades geo do banco
            </p>
          </Card>
        </Link>
        <Link to="/pages" className="no-underline text-inherit">
          <Card hover padding="lg">
            <h3 className="font-semibold text-gabi-accent m-0">2. Gerar páginas</h3>
            <p className="text-sm text-gabi-muted mt-1 mb-0">
              Criar listas, mapas e relatórios a partir das tabelas
            </p>
          </Card>
        </Link>
        <Link to="/audit" className="no-underline text-inherit">
          <Card hover padding="lg">
            <h3 className="font-semibold text-gabi-accent m-0">3. Auditoria</h3>
            <p className="text-sm text-gabi-muted mt-1 mb-0">Trilha de ações no sistema</p>
          </Card>
        </Link>
      </div>

      <h3 className="font-semibold mb-3">Páginas geradas</h3>
      {pages.length === 0 ? (
        <p className="text-slate-500 text-sm">
          Nenhuma página ainda. Vá em <Link to="/introspect" className="underline">Banco de dados</Link>{' '}
          para gerar a primeira.
        </p>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.id} className="bg-white border rounded-lg px-4 py-3 flex justify-between">
              <span>{p.label}</span>
              <Link
                to={
                  p.type === 'map'
                    ? `/p/${p.resource}/map`
                    : p.type === 'report'
                      ? `/p/${p.resource}/report`
                      : p.type === 'dashboard'
                        ? `/p/${p.resource}/dashboard`
                        : `/p/${p.resource}/list`
                }
                className="text-sm font-medium text-gabi-accent"
              >
                Abrir →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
