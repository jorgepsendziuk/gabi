import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import {
  isSupabaseHost,
  parsePostgresUri,
  supabaseDirectPreset,
  supabasePoolerPreset,
  type SupabasePoolerMode,
} from '../lib/supabase-connection';
import { gabiTheme } from '@gabi/ui';

interface SupabaseTemplate {
  available: boolean;
  projectRef?: string;
  meta?: {
    host: string;
    port: number;
    database: string;
    user: string;
    ssl: boolean;
  };
  direct?: {
    host: string;
    port: number;
    database: string;
    user: string;
    ssl: boolean;
  };
  hints?: {
    sessionPoolerPort: number;
    transactionPoolerPort: number;
    uriPath: string;
  };
}

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

type FormState = {
  name: string;
  slug: string;
  description: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  isDefault: boolean;
  isOdkSource: boolean;
};

const emptyForm: FormState = {
  name: '',
  slug: '',
  description: '',
  host: '',
  port: 5432,
  database: '',
  user: '',
  password: '',
  ssl: false,
  isDefault: false,
  isOdkSource: false,
};

function connectionToForm(c: Connection): FormState {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    host: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
    password: '',
    ssl: c.ssl,
    isDefault: c.isDefault,
    isOdkSource: c.isOdkSource ?? false,
  };
}

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [supabaseTemplate, setSupabaseTemplate] = useState<SupabaseTemplate | null>(null);
  const [connectionUri, setConnectionUri] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [poolerHost, setPoolerHost] = useState('');
  const [uriError, setUriError] = useState('');

  const load = () => {
    setLoading(true);
    apiFetch<Connection[]>('/api/connections')
      .then(setConnections)
      .catch((e) => setMessage(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    apiFetch<SupabaseTemplate>('/api/connections/supabase-template')
      .then((t) => {
        setSupabaseTemplate(t);
        if (t.available && t.projectRef) {
          setProjectRef(t.projectRef);
          if (t.meta?.host) setPoolerHost(t.meta.host);
        }
      })
      .catch(() => setSupabaseTemplate({ available: false }));
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setConnectionUri('');
    setUriError('');
  };

  const applyConnectionFields = (fields: Partial<FormState>, opts?: { keepPassword?: boolean }) => {
    setForm((prev) => ({
      ...prev,
      ...fields,
      password: opts?.keepPassword ? prev.password : (fields.password ?? prev.password),
      ssl: fields.ssl ?? true,
    }));
    setMessage('Campos preenchidos — informe a senha e teste a conexão.');
  };

  const fillFromUri = () => {
    const parsed = parsePostgresUri(connectionUri);
    if (parsed.error) {
      setUriError(parsed.error);
      return;
    }
    setUriError('');
    const ref = parsed.user?.match(/\.([a-z0-9]{15,25})$/i)?.[1];
    if (ref) setProjectRef(ref);
    if (parsed.host) setPoolerHost(parsed.host);
    applyConnectionFields(
      {
        host: parsed.host ?? '',
        port: parsed.port ?? 5432,
        database: parsed.database ?? 'postgres',
        user: parsed.user ?? '',
        password: parsed.password ?? '',
        ssl: parsed.ssl ?? true,
      },
      { keepPassword: !parsed.password },
    );
  };

  const applySupabasePreset = (mode: SupabasePoolerMode | 'direct' | 'meta') => {
    if (mode === 'meta' && supabaseTemplate?.available && supabaseTemplate.meta) {
      applyConnectionFields({
        host: supabaseTemplate.meta.host,
        port: supabaseTemplate.meta.port,
        database: supabaseTemplate.meta.database,
        user: supabaseTemplate.meta.user,
        ssl: supabaseTemplate.meta.ssl,
      });
      return;
    }
    const ref = projectRef.trim();
    if (!ref) {
      setMessage('Informe o project ref do Supabase (ex: gjtgxnmodzsnnqosxpgl).');
      return;
    }
    if (mode === 'direct') {
      applyConnectionFields(supabaseDirectPreset(ref));
      return;
    }
    const host = poolerHost.trim() || supabaseTemplate?.meta?.host;
    if (!host) {
      setMessage('Cole a URI do pooler ou informe o host (aws-…pooler.supabase.com).');
      return;
    }
    if (mode !== 'session' && mode !== 'transaction') return;
    applyConnectionFields(supabasePoolerPreset(ref, host, mode));
  };

  const startEdit = (c: Connection) => {
    setEditingId(c.id);
    setForm(connectionToForm(c));
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const testPayload = () => ({
    host: form.host,
    port: form.port,
    database: form.database,
    user: form.user,
    password: form.password,
    ssl: form.ssl,
  });

  const testForm = async () => {
    if (!form.password && !editingId) {
      setMessage('Informe a senha para testar.');
      return;
    }
    setMessage('Testando...');
    try {
      const r = await apiFetch<{ ok: boolean; version?: string }>('/api/connections/test', {
        method: 'POST',
        body: JSON.stringify(testPayload()),
      });
      setMessage(r.ok ? `OK: ${r.version?.slice(0, 80)}` : 'Falhou');
    } catch (e) {
      setMessage(String(e));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Salvando...');
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || undefined,
        host: form.host,
        port: form.port,
        database: form.database,
        user: form.user,
        ssl: form.ssl,
        isDefault: form.isDefault,
        isOdkSource: form.isOdkSource,
      };
      if (form.password) body.password = form.password;

      if (editingId) {
        if (!form.password) delete body.password;
        await apiFetch(`/api/connections/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setMessage('Conexão atualizada.');
      } else {
        if (!form.password) {
          setMessage('Senha é obrigatória ao criar.');
          return;
        }
        await apiFetch('/api/connections', {
          method: 'POST',
          body: JSON.stringify({ ...body, password: form.password }),
        });
        setMessage('Conexão criada.');
      }
      resetForm();
      load();
    } catch (err) {
      setMessage(String(err));
    }
  };

  const remove = async (c: Connection) => {
    if (
      !confirm(
        `Remover "${c.name}"?\n\nPáginas e fontes de dados vinculadas a esta conexão também serão excluídas.`,
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/connections/${c.id}`, { method: 'DELETE' });
      if (editingId === c.id) resetForm();
      setMessage('Conexão removida.');
      load();
    } catch (e) {
      setMessage(String(e));
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
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold mb-2" style={{ color: gabiTheme.colors.primary }}>
        Conexões de banco
      </h2>
      <p className="text-slate-600 text-sm mb-6">
        O <strong>banco meta</strong> (<code>apps/api/.env</code>) guarda usuários e este cadastro.
        Cada conexão abaixo é um PostgreSQL de dados (ODK, ERP, Supabase, etc.). Use o{' '}
        <strong>Atalho Supabase</strong> para colar a URI do dashboard.
      </p>

      {message && (
        <div className="mb-4 p-3 bg-slate-100 rounded text-sm text-slate-700">{message}</div>
      )}

      <form onSubmit={submit} className="bg-white border rounded-lg p-5 space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{editingId ? 'Editar conexão' : 'Nova conexão'}</h3>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm text-slate-500 underline">
              Cancelar edição
            </button>
          )}
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
          <div>
            <h4 className="font-medium text-emerald-900 text-sm">Atalho Supabase</h4>
            <p className="text-xs text-emerald-800 mt-1">
              Cole a connection string do dashboard ou use o project ref. SSL é marcado automaticamente.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full border border-emerald-200 rounded px-3 py-2 text-xs font-mono min-h-[4rem]"
              placeholder="postgresql://postgres.REF:SENHA@aws-….pooler.supabase.com:5432/postgres"
              value={connectionUri}
              onChange={(e) => {
                setConnectionUri(e.target.value);
                setUriError('');
              }}
            />
            {uriError && <p className="text-xs text-red-700">{uriError}</p>}
            <button
              type="button"
              onClick={fillFromUri}
              className="self-start px-3 py-1.5 text-xs rounded border border-emerald-300 bg-white text-emerald-900"
            >
              Preencher da URI
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="border border-emerald-200 rounded px-3 py-2 text-sm bg-white"
              placeholder="Project ref (Settings → General)"
              value={projectRef}
              onChange={(e) => setProjectRef(e.target.value)}
            />
            <input
              className="border border-emerald-200 rounded px-3 py-2 text-sm bg-white font-mono text-xs"
              placeholder="Host pooler (opcional se colou URI)"
              value={poolerHost}
              onChange={(e) => setPoolerHost(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {supabaseTemplate?.available && supabaseTemplate.meta && (
              <button
                type="button"
                onClick={() => applySupabasePreset('meta')}
                className="px-2 py-1 text-xs rounded bg-emerald-700 text-white"
              >
                Pooler do meta GABI
              </button>
            )}
            <button
              type="button"
              onClick={() => applySupabasePreset('session')}
              className="px-2 py-1 text-xs rounded border border-emerald-400 bg-white text-emerald-900"
            >
              Pooler session (:5432)
            </button>
            <button
              type="button"
              onClick={() => applySupabasePreset('transaction')}
              className="px-2 py-1 text-xs rounded border border-emerald-400 bg-white text-emerald-900"
            >
              Pooler transaction (:6543)
            </button>
            <button
              type="button"
              onClick={() => applySupabasePreset('direct')}
              className="px-2 py-1 text-xs rounded border border-emerald-400 bg-white text-emerald-900"
            >
              Direct db.REF.supabase.co
            </button>
          </div>
        </div>
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Nome (ex: ODK Supabase)"
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
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Descrição (opcional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
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
          placeholder={editingId ? 'Senha (deixe vazio para manter)' : 'Senha'}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required={!editingId}
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
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          Conexão padrão (introspecção sem seletor)
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
          <button type="button" onClick={testForm} className="px-3 py-2 text-sm border rounded">
            Testar
          </button>
          <button
            type="submit"
            className="px-3 py-2 text-sm text-white rounded flex-1"
            style={{ background: gabiTheme.colors.accent }}
          >
            {editingId ? 'Salvar alterações' : 'Criar conexão'}
          </button>
        </div>
      </form>

      <div className="bg-white border rounded-lg p-5">
        <h3 className="font-semibold mb-3">Conexões cadastradas</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma conexão cadastrada.</p>
        ) : (
          <ul className="space-y-3">
            {connections.map((c) => (
              <li key={c.id} className="border rounded p-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.name}
                      {c.isDefault && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          padrão
                        </span>
                      )}
                      {isSupabaseHost(c.host) && (
                        <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          Supabase
                        </span>
                      )}
                      {c.isOdkSource && (
                        <>
                          <span className="ml-2 text-xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                            ODK
                          </span>
                          <Link
                            to="/odk"
                            className="ml-2 text-xs text-amber-900 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver instalação
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-slate-500 font-mono text-xs mt-1 truncate">
                      {c.slug} · {c.host}:{c.port}/{c.database}
                    </p>
                    {c.description && (
                      <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                    )}
                    {c.lastIntrospectedAt && (
                      <p className="text-xs text-slate-400 mt-1">
                        Introspectado: {new Date(c.lastIntrospectedAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => testExisting(c.id)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Testar
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="text-xs px-2 py-1 border rounded text-red-700 border-red-200"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
