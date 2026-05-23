import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';

interface Page {
  id: string;
  type: string;
  resource: string;
  label: string;
  dataSourceId: string;
}

export function PagesListPage() {
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    apiFetch<Page[]>('/api/generator/pages').then(setPages);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gabi-primary">Páginas geradas</h2>
      <div className="grid gap-3">
        {pages.map((p) => (
          <div key={p.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{p.label}</p>
              <p className="text-xs text-slate-500 font-mono">
                {p.type} · {p.dataSourceId} · {p.resource}
              </p>
            </div>
            <Link
              to={p.type === 'map' ? `/p/${p.resource}/map` : `/p/${p.resource}/list`}
              className="text-gabi-accent font-medium text-sm"
            >
              Abrir
            </Link>
          </div>
        ))}
        {pages.length === 0 && (
          <p className="text-slate-500">Nenhuma página. Gere em Banco de dados.</p>
        )}
      </div>
    </div>
  );
}
