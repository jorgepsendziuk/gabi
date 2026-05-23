import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { gabiTheme } from '@gabi/ui';

interface TableInfo {
  schema: string;
  name: string;
  type: string;
  geometryColumn?: string;
  suggestedPages: string[];
  odk: { isOdkTable: boolean; signals: string[] };
}

interface Connection {
  id: string;
  name: string;
  isDefault: boolean;
}

export function IntrospectPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Connection[]>('/api/connections').then((list) => {
      setConnections(list);
      const def = list.find((c) => c.isDefault) ?? list[0];
      if (def) setConnectionId(def.id);
    });
  }, []);

  const load = () => {
    if (!connectionId) return;
    setLoading(true);
    apiFetch<{ tables: TableInfo[] }>(`/api/introspect?connectionId=${connectionId}`)
      .then((r) => setTables(r.tables))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (connectionId) load();
  }, [connectionId]);

  const generate = async (schema: string, table: string, template: 'list' | 'map') => {
    const key = `${schema}.${table}.${template}`;
    setGenerating(key);
    try {
      await apiFetch('/api/generator/pages', {
        method: 'POST',
        body: JSON.stringify({ connectionId, schema, table, template }),
      });
      alert(`Página ${template} criada para ${schema}.${table}`);
    } catch (e) {
      alert(String(e));
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <p>Carregando introspecção...</p>;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold" style={{ color: gabiTheme.colors.primary }}>
          Banco de dados
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Conexão:</label>
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 text-sm text-white rounded"
          style={{ background: gabiTheme.colors.primary }}
        >
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white" style={{ background: gabiTheme.colors.primary }}>
              <th className="p-3">Tabela</th>
              <th className="p-3">Geo</th>
              <th className="p-3">ODK</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={`${t.schema}.${t.name}`} className="border-t">
                <td className="p-3 font-mono">
                  {t.schema}.{t.name}
                  <span className="text-slate-400 ml-2">({t.type})</span>
                </td>
                <td className="p-3">
                  {t.geometryColumn ? (
                    <span className="text-green-700">{t.geometryColumn}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3">
                  {t.odk.isOdkTable ? (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      ODK
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3 space-x-2">
                  <button
                    type="button"
                    disabled={generating !== null}
                    onClick={() => generate(t.schema, t.name, 'list')}
                    className="px-2 py-1 text-xs rounded text-white"
                    style={{ background: gabiTheme.colors.accent }}
                  >
                    {generating === `${t.schema}.${t.name}.list` ? '...' : 'Lista'}
                  </button>
                  {t.suggestedPages.includes('map') && (
                    <button
                      type="button"
                      disabled={generating !== null}
                      onClick={() => generate(t.schema, t.name, 'map')}
                      className="px-2 py-1 text-xs rounded border"
                      style={{ borderColor: gabiTheme.colors.primary, color: gabiTheme.colors.primary }}
                    >
                      {generating === `${t.schema}.${t.name}.map` ? '...' : 'Mapa'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
