import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { gabiTheme } from '@gabi/ui';

interface Connection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  isDefault: boolean;
  isOdkSource?: boolean;
  lastIntrospectedAt?: string;
}

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  host: 'localhost',
  port: 5432,
  database: '',
  user: '',
  password: '',
  ssl: false,
  isDefault: false,
  isOdkSource: false,
};

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    apiFetch<Connection[]>('/api/connections')
      .then(setConnections)
      .catch((e) => setMessage(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const testForm = async () => {
    setMessage('Testando...');
    try {
      const r = await apiFetch<{ ok: boolean; version?: string }>('/api/connections/test', {
        method: 'POST',
        body: JSON.stringify({
          host: form.host,
          port: form.port,
          database: form.database,
          user: form.user,
          password: form.password,
          ssl: form.ssl,
        }),
      });
      setMessage(r.ok ? `OK: ${r.version?.slice(0, 60)}...` : 'Falhou');
    } catch (e) {
      setMessage(String(e));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Salvando...');
    try {
      await apiFetch('/api/connections', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setMessage('Conexão criada.');
      load();
    } catch (err) {
      setMessage(String(err));
    }
  };

  const testExisting = async (id: string) => {
    try {
      const r = await apiFetch<{ ok: boolean; version?: string }>(`/api/connections/${id}/test`, {
        method: 'POST',
      });
      setMessage(r.ok ? 'Conexão ativa.' : 'Falhou');
    } catch (e) {
      setMessage(String(e));
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-2" style={{ color: gabiTheme.colors.primary }}>
        Conexões de banco
      </h2>
      <p className="text-slate-600 text-sm mb-6">
        O GABI usa um <strong>banco meta</strong> fixo (<code>apps/api/.env</code>) para usuários,
        permissões e este cadastro. Cada conexão abaixo é um PostgreSQL de dados (cliente, ODK, ERP).
        Marque <strong>Fonte ODK</strong> para leitura somente no Postgres original e gravação de
        alterações em <code>gabi_odk_change</code> neste servidor.
      </p>

      {message && (
        <div className="mb-4 p-3 bg-slate-100 rounded text-sm text-slate-700">{message}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={submit} className="bg-white border rounded-lg p-5 space-y-3">
          <h3 className="font-semibold">Nova conexão</h3>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Nome (ex: Cliente ABC)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Slug (opcional)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              className="col-span-2 border rounded px-3 py-2 text-sm"
              placeholder="Host"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              required
            />
            <input
              type="number"
              className="border rounded px-3 py-2 text-sm"
              placeholder="Porta"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
            />
          </div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Database"
            value={form.database}
            onChange={(e) => setForm({ ...form, database: e.target.value })}
            required
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Usuário"
            value={form.user}
            onChange={(e) => setForm({ ...form, user: e.target.value })}
            required
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ssl}
              onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
            />
            SSL
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isOdkSource}
              onChange={(e) => setForm({ ...form, isOdkSource: e.target.checked })}
            />
            Fonte ODK (somente leitura + overlay GABI)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={testForm}
              className="px-3 py-2 text-sm border rounded"
            >
              Testar
            </button>
            <button
              type="submit"
              className="px-3 py-2 text-sm text-white rounded flex-1"
              style={{ background: gabiTheme.colors.accent }}
            >
              Salvar conexão
            </button>
          </div>
        </form>

        <div className="bg-white border rounded-lg p-5">
          <h3 className="font-semibold mb-3">Conexões cadastradas</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : connections.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma conexão.</p>
          ) : (
            <ul className="space-y-3">
              {connections.map((c) => (
                <li key={c.id} className="border rounded p-3 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {c.name}
                        {c.isDefault && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                            padrão
                          </span>
                        )}
                        {c.isOdkSource && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                            ODK overlay
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500 font-mono text-xs mt-1">
                        {c.host}:{c.port}/{c.database}
                      </p>
                      {c.lastIntrospectedAt && (
                        <p className="text-xs text-slate-400 mt-1">
                          Introspectado: {new Date(c.lastIntrospectedAt).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => testExisting(c.id)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Testar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
