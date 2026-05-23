import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface AuditRow {
  id: string;
  user_id: string | null;
  entity: string;
  entity_id: string;
  action: string;
  created_at: string;
}

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    apiFetch<AuditRow[]>('/api/audit?limit=100').then(setRows);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gabi-primary">Auditoria</h2>
      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="p-2">Quando</th>
              <th className="p-2">Ação</th>
              <th className="p-2">Entidade</th>
              <th className="p-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                <td className="p-2 font-mono">{r.action}</td>
                <td className="p-2">{r.entity}</td>
                <td className="p-2 font-mono text-xs">{r.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
