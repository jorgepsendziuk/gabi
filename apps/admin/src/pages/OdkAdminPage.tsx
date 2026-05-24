import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { gabiTheme } from '@gabi/ui';

interface Connection {
  id: string;
  name: string;
  isDefault: boolean;
  isOdkSource?: boolean;
  host: string;
  port: number;
  database: string;
}

interface OdkUserRow {
  kind: string;
  id?: string | number;
  email?: string;
  displayName?: string;
  username?: string;
  active?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  extra?: { projectName?: string; actorId?: unknown };
}

interface OdkFormRow {
  id?: string | number;
  xmlFormId?: string;
  name?: string;
  version?: string;
  projectName?: string;
  createdAt?: string;
}

interface OdkSchemaField {
  path: string;
  name: string;
  type: string;
  label?: string;
  hint?: string;
  dbColumn?: string;
  dbTable?: string;
  choices?: Array<{ value: string; label: string }>;
}

interface OdkFormSchema {
  formId: string;
  formName?: string;
  fieldCount: number;
  dataModelMapped: number;
  fields: OdkSchemaField[];
  warnings: string[];
}

interface OdkOverview {
  connectionId: string;
  connection: {
    id: string;
    name: string;
    host: string;
    port: number;
    database: string;
    isOdkSource: boolean;
  };
  scannedAt: string;
  readOnly: boolean;
  platform: {
    platform: string;
    confidence: string;
    signals: string[];
    schemas: string[];
  };
  database: {
    name: string;
    version: string;
    sizeBytes: number | null;
    connectedAs: string;
    accessibleSchemas: string[];
  };
  server: {
    preferences: Array<{ key: string; value: string }>;
    config: Array<{ key: string; value: string }>;
  };
  users: OdkUserRow[];
  forms: OdkFormRow[];
  stats: {
    baseTableCount: number;
    submissionLikeTables: number;
  };
  warnings: string[];
}

function formatBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function platformLabel(p: string): string {
  if (p === 'central') return 'ODK Central';
  if (p === 'aggregate') return 'ODK Aggregate';
  return 'ODK (não classificado)';
}

export function OdkAdminPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [data, setData] = useState<OdkOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [schemaFormId, setSchemaFormId] = useState<string | null>(null);
  const [schema, setSchema] = useState<OdkFormSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  useEffect(() => {
    apiFetch<Connection[]>('/api/connections').then((list) => {
      const odkFirst = [...list].sort((a, b) => {
        if (a.isOdkSource && !b.isOdkSource) return -1;
        if (!a.isOdkSource && b.isOdkSource) return 1;
        if (a.isDefault && !b.isDefault) return -1;
        return 0;
      });
      setConnections(odkFirst);
      const pick =
        odkFirst.find((c) => c.isOdkSource) ?? odkFirst.find((c) => c.isDefault) ?? odkFirst[0];
      if (pick) setConnectionId(pick.id);
    });
  }, []);

  const load = () => {
    if (!connectionId) return;
    setLoading(true);
    setError('');
    apiFetch<OdkOverview>(`/api/odk/overview?connectionId=${connectionId}`)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (connectionId) load();
    setSchemaFormId(null);
    setSchema(null);
    setSchemaError('');
  }, [connectionId]);

  const loadSchema = async (formId: string) => {
    if (!connectionId) return;
    if (formId.startsWith('md5:')) {
      setSchemaError('Use o Form ID (ex: laudov1), não o URI interno md5:…');
      return;
    }
    setSchemaFormId(formId);
    setSchemaLoading(true);
    setSchema(null);
    setSchemaError('');
    try {
      const r = await apiFetch<OdkFormSchema>(
        `/api/odk/forms/${encodeURIComponent(formId)}/schema?connectionId=${encodeURIComponent(connectionId)}`,
      );
      setSchema(r);
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : String(e));
    } finally {
      setSchemaLoading(false);
    }
  };

  const siteUsers = data?.users.filter((u) => u.kind === 'site') ?? [];
  const appUsers = data?.users.filter((u) => u.kind === 'app') ?? [];

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold mb-2" style={{ color: gabiTheme.colors.primary }}>
        ODK — instalação
      </h2>
      <p className="text-slate-600 text-sm mb-4">
        Leitura direta do PostgreSQL da conexão (somente SELECT). Usuários, formulários cadastrados
        e preferências do servidor — sem alterar o banco ODK.
      </p>

      {connections.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma conexão cadastrada.{' '}
          <Link to="/connections" className="underline">
            Adicionar conexão
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-slate-600">
            Conexão:{' '}
            <select
              className="border rounded px-2 py-1 text-sm ml-1"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isOdkSource ? ' (ODK)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-sm px-3 py-1 border rounded"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <Link to="/connections" className="text-sm text-slate-500 underline">
            Gerenciar conexões
          </Link>
          <Link to="/introspect" className="text-sm text-slate-500 underline">
            Introspecção de tabelas
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      {data && (
        <>
          {data.warnings.length > 0 && (
            <ul className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900 space-y-1">
              {data.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Plataforma</p>
              <p className="text-lg font-semibold mt-1">{platformLabel(data.platform.platform)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Confiança: {data.platform.confidence}
                {data.platform.signals.length > 0 && (
                  <> · {data.platform.signals.join(', ')}</>
                )}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Banco</p>
              <p className="text-sm font-mono mt-1 truncate">
                {data.connection.host}:{data.connection.port}/{data.database.name}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tamanho: {formatBytes(data.database.sizeBytes)} · Conectado como{' '}
                <code>{data.database.connectedAs}</code>
              </p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Estatísticas</p>
              <p className="text-sm mt-1">
                {data.stats.baseTableCount} tabelas · ~{data.stats.submissionLikeTables} com
                colunas de submissão ODK
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data.forms.length} formulários · {data.users.length} usuários listados
              </p>
            </div>
          </div>

          {(data.server.preferences.length > 0 || data.server.config.length > 0) && (
            <section className="bg-white border rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-3">Servidor / configuração</h3>
              <div className="grid md:grid-cols-2 gap-4 max-h-64 overflow-auto text-sm">
                {data.server.preferences.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Preferências (Aggregate)</p>
                    <table className="w-full text-xs">
                      <tbody>
                        {data.server.preferences.map((p) => (
                          <tr key={p.key} className="border-t">
                            <td className="py-1 pr-2 font-mono text-slate-600">{p.key}</td>
                            <td className="py-1 truncate max-w-xs" title={p.value}>
                              {p.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data.server.config.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Config (Central)</p>
                    <table className="w-full text-xs">
                      <tbody>
                        {data.server.config.map((p) => (
                          <tr key={p.key} className="border-t">
                            <td className="py-1 pr-2 font-mono text-slate-600">{p.key}</td>
                            <td className="py-1 truncate max-w-xs" title={p.value}>
                              {p.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="bg-white border rounded-lg p-4 mb-6 overflow-x-auto">
            <h3 className="font-semibold mb-3">
              Usuários do site ({siteUsers.length})
            </h3>
            {siteUsers.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum usuário encontrado nesta conexão.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="p-2">E-mail / ID</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Ativo</th>
                    <th className="p-2">Último login</th>
                  </tr>
                </thead>
                <tbody>
                  {siteUsers.map((u, i) => (
                    <tr key={`${u.email ?? u.id ?? i}`} className="border-b border-slate-100">
                      <td className="p-2 font-mono text-xs">{u.email ?? u.username ?? u.id}</td>
                      <td className="p-2">{u.displayName ?? '—'}</td>
                      <td className="p-2">{u.active == null ? '—' : u.active ? 'Sim' : 'Não'}</td>
                      <td className="p-2 text-xs text-slate-500">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString('pt-BR')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {appUsers.length > 0 && (
            <section className="bg-white border rounded-lg p-4 mb-6 overflow-x-auto">
              <h3 className="font-semibold mb-3">App users / Collect ({appUsers.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="p-2">Nome</th>
                    <th className="p-2">Projeto</th>
                  </tr>
                </thead>
                <tbody>
                  {appUsers.map((u, i) => (
                    <tr key={`${u.username ?? i}`} className="border-b border-slate-100">
                      <td className="p-2">{u.displayName ?? u.username}</td>
                      <td className="p-2 text-slate-500">{u.extra?.projectName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="bg-white border rounded-lg p-4 mb-6 overflow-x-auto">
            <h3 className="font-semibold mb-3">Formulários ({data.forms.length})</h3>
            {data.forms.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum formulário no catálogo do servidor.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="p-2">Form ID / XML</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Versão</th>
                    <th className="p-2">Projeto</th>
                    <th className="p-2 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {data.forms.map((f, i) => {
                    const formId = f.xmlFormId ? String(f.xmlFormId) : '';
                    const displayId = formId || String(f.id ?? '—');
                    return (
                      <tr key={`${displayId}-${i}`} className="border-b border-slate-100">
                        <td className="p-2 font-mono text-xs">{displayId}</td>
                        <td className="p-2">{f.name ?? '—'}</td>
                        <td className="p-2">{f.version ?? '—'}</td>
                        <td className="p-2 text-slate-500">{f.projectName ?? '—'}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
                            disabled={!formId || schemaLoading}
                            title={formId ? 'Labels e escolhas do XML' : 'Sem FORM_ID — não é possível carregar schema'}
                            onClick={() => loadSchema(formId)}
                          >
                            {schemaFormId === formId && schemaLoading ? '...' : 'Schema'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {schemaFormId && (
            <section className="bg-white border rounded-lg p-4 mb-6 overflow-x-auto">
              <div className="flex justify-between items-start gap-2 mb-3">
                <div>
                  <h3 className="font-semibold">
                    Schema: {schema?.formName ?? schemaFormId}
                  </h3>
                  {schema && (
                    <p className="text-xs text-slate-500 mt-1">
                      {schema.fieldCount} campos · {schema.dataModelMapped} mapeados para colunas
                      do banco
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => {
                    setSchemaFormId(null);
                    setSchema(null);
                  }}
                >
                  Fechar
                </button>
              </div>
              {schemaError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {schemaError}
                </div>
              )}
              {schemaLoading && (
                <p className="text-sm text-slate-500">Lendo XML do formulário no banco...</p>
              )}
              {schema && schema.warnings.length > 0 && (
                <ul className="text-xs text-amber-800 mb-2">
                  {schema.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              )}
              {schema && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="p-2">Label</th>
                      <th className="p-2">Campo</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Coluna BD</th>
                      <th className="p-2">Escolhas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.fields.map((f) => (
                      <tr key={f.path} className="border-b border-slate-50">
                        <td className="p-2">{f.label ?? '—'}</td>
                        <td className="p-2 font-mono">{f.name}</td>
                        <td className="p-2 text-slate-500">{f.type}</td>
                        <td className="p-2 font-mono text-slate-600">
                          {f.dbTable && f.dbColumn
                            ? `${f.dbTable}.${f.dbColumn}`
                            : '—'}
                        </td>
                        <td className="p-2 text-slate-500 max-w-xs truncate" title={
                          f.choices?.map((c) => `${c.value}=${c.label}`).join(', ')
                        }>
                          {f.choices?.length
                            ? f.choices
                                .slice(0, 3)
                                .map((c) => c.label)
                                .join(', ') + (f.choices.length > 3 ? '…' : '')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer mb-2">Detalhes técnicos</summary>
            <p className="mb-1">
              Schemas: {data.platform.schemas.join(', ') || data.database.accessibleSchemas.join(', ')}
            </p>
            <p className="font-mono break-all">{data.database.version}</p>
            <p className="mt-1">Varredura: {new Date(data.scannedAt).toLocaleString('pt-BR')}</p>
          </details>
        </>
      )}
    </div>
  );
}
