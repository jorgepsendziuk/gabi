import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useModules } from '../contexts/ModuleContext';
import { gabiTheme } from '@gabi/ui';

interface OdkDetection {
  isOdkTable: boolean;
  role: string;
  confidence: number;
  signals: string[];
  score?: number;
}

interface OdkForm {
  id: string;
  label: string;
  schema: string;
  mainTable: string;
  repeatTables: Array<{ schema: string; name: string; linkColumn?: string }>;
  confidence: number;
  signals: string[];
  suggestedPages: string[];
}

interface TableInfo {
  schema: string;
  name: string;
  type: string;
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
  geoSource?: string;
  suggestedPages: string[];
  odk: OdkDetection;
}

interface Connection {
  id: string;
  name: string;
  isDefault: boolean;
  isOdkSource?: boolean;
}

interface IntrospectResult {
  tables: TableInfo[];
  odkForms: OdkForm[];
  connectionIsOdkSource?: boolean;
}

export function IntrospectPage() {
  const { activeModuleId } = useModules();
  const moduleId = activeModuleId ?? 'mod_default';
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [odkForms, setOdkForms] = useState<OdkForm[]>([]);
  const [connectionIsOdkSource, setConnectionIsOdkSource] = useState(false);
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
    apiFetch<IntrospectResult>(`/api/introspect?connectionId=${connectionId}`)
      .then((r) => {
        setTables(r.tables);
        setOdkForms(r.odkForms ?? []);
        setConnectionIsOdkSource(Boolean(r.connectionIsOdkSource));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (connectionId) load();
  }, [connectionId]);

  const generate = async (schema: string, table: string, template: 'list' | 'map' | 'report') => {
    const key = `${schema}.${table}.${template}`;
    setGenerating(key);
    try {
      await apiFetch('/api/generator/pages', {
        method: 'POST',
        body: JSON.stringify({ connectionId, schema, table, template, moduleId }),
      });
      alert(`Página ${template} criada para ${schema}.${table}`);
    } catch (e) {
      alert(String(e));
    } finally {
      setGenerating(null);
    }
  };

  const formatBulkResult = (
    label: string,
    res: {
      created: Array<{ formId: string; label: string }>;
      skipped: Array<{ formId: string; reason: string }>;
      formsDetected: number;
    },
  ) => {
    const lines = [
      `${label}: ${res.created.length} página(s) criada(s) de ${res.formsDetected} formulário(s).`,
    ];
    if (res.skipped.length > 0) {
      lines.push(
        `Ignorados: ${res.skipped.map((s) => `${s.formId} (${s.reason})`).join(', ')}`,
      );
    }
    return lines.join('\n');
  };

  const generateAllOdkForms = async (template: 'list' | 'map') => {
    setGenerating(`odk-bulk-${template}`);
    try {
      const res = await apiFetch<{
        created: Array<{ formId: string; label: string }>;
        skipped: Array<{ formId: string; reason: string }>;
        formsDetected: number;
      }>('/api/generator/odk-forms', {
        method: 'POST',
        body: JSON.stringify({ connectionId, template, moduleId }),
      });
      alert(formatBulkResult(template === 'map' ? 'Mapas' : 'Listas', res));
    } catch (e) {
      alert(String(e));
    } finally {
      setGenerating(null);
    }
  };

  const generateAllOdkFormsListAndMap = async () => {
    setGenerating('odk-bulk-both');
    try {
      const listRes = await apiFetch<{
        created: Array<{ formId: string; label: string }>;
        skipped: Array<{ formId: string; reason: string }>;
        formsDetected: number;
      }>('/api/generator/odk-forms', {
        method: 'POST',
        body: JSON.stringify({ connectionId, template: 'list', moduleId }),
      });
      const mapRes = await apiFetch<typeof listRes>('/api/generator/odk-forms', {
        method: 'POST',
        body: JSON.stringify({ connectionId, template: 'map', moduleId }),
      });
      alert([formatBulkResult('Listas', listRes), formatBulkResult('Mapas', mapRes)].join('\n\n'));
    } catch (e) {
      alert(String(e));
    } finally {
      setGenerating(null);
    }
  };

  const odkLabel = (t: TableInfo) => {
    if (t.odk.isOdkTable) {
      const role =
        t.odk.role === 'submission'
          ? 'submissão'
          : t.odk.role === 'repeat'
            ? 'repeat'
            : t.odk.role === 'attachment'
              ? 'anexo'
              : 'ODK';
      return (
        <span
          className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded"
          title={t.odk.signals.join(', ')}
        >
          {role}
        </span>
      );
    }
    if (connectionIsOdkSource && (t.odk.score ?? 0) >= 1) {
      return (
        <span
          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
          title={t.odk.signals.join(', ')}
        >
          possível
        </span>
      );
    }
    return '—';
  };

  if (connections.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: gabiTheme.colors.primary }}>
          Banco de dados
        </h2>
        <p className="text-slate-600 text-sm">
          Cadastre uma conexão em <strong>Conexões</strong> (Postgres ODK, ERP, etc.) para introspectar
          tabelas. O banco meta do GABI (usuários, permissões) não aparece aqui — ele é configurado só
          no <code>apps/api/.env</code>.
        </p>
      </div>
    );
  }

  if (loading && connectionId) return <p>Carregando introspecção...</p>;

  const activeConn = connections.find((c) => c.id === connectionId);

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
                {c.isOdkSource ? ' (ODK)' : ''}
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

      {(connectionIsOdkSource || activeConn?.isOdkSource) && odkForms.length === 0 && (
        <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Conexão marcada como <strong>fonte ODK</strong>, mas nenhum formulário foi identificado
          automaticamente. Verifique se as tabelas têm colunas como <code>_uuid</code>,{' '}
          <code>_submission_time</code> ou <code>_parent_id</code> (repeats).
        </p>
      )}

      {odkForms.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-amber-900">
                Formulários ODK detectados ({odkForms.length})
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Agrupamento por colunas típicas de submissão ODK (<code>_uuid</code>,{' '}
                <code>_submission_time</code>, etc.) — confiança ≥ 50%, sem catálogo (
                <code>_form_info</code>). Passe o mouse no item para ver os sinais.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generating !== null}
                onClick={() => generateAllOdkForms('list')}
                className="px-3 py-1.5 text-sm rounded text-white"
                style={{ background: gabiTheme.colors.accent }}
              >
                {generating === 'odk-bulk-list' ? 'Gerando...' : 'Gerar todas (lista)'}
              </button>
              <button
                type="button"
                disabled={generating !== null}
                onClick={() => generateAllOdkForms('map')}
                className="px-3 py-1.5 text-sm rounded border"
                style={{ borderColor: gabiTheme.colors.primary, color: gabiTheme.colors.primary }}
              >
                {generating === 'odk-bulk-map' ? 'Gerando...' : 'Gerar todas (mapa)'}
              </button>
              <button
                type="button"
                disabled={generating !== null}
                onClick={generateAllOdkFormsListAndMap}
                className="px-3 py-1.5 text-sm rounded text-white"
                style={{ background: gabiTheme.colors.primary }}
              >
                {generating === 'odk-bulk-both' ? 'Gerando...' : 'Lista + mapa'}
              </button>
            </div>
          </div>
          <ul className="space-y-2">
            {odkForms.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-white rounded border border-amber-100 px-3 py-2 text-sm"
              >
                <div title={f.signals.join(', ') || undefined}>
                  <span className="font-mono font-medium">
                    {f.schema}.{f.mainTable}
                  </span>
                  <span className="text-slate-500 ml-2">
                    confiança {Math.round(f.confidence * 100)}%
                  </span>
                  {f.repeatTables.length > 0 && (
                    <span className="text-slate-500 ml-2">
                      · {f.repeatTables.length} repeat(s):{' '}
                      {f.repeatTables.map((r) => r.name).join(', ')}
                    </span>
                  )}
                </div>
                <div className="space-x-2">
                  <button
                    type="button"
                    disabled={generating !== null}
                    onClick={() => generate(f.schema, f.mainTable, 'list')}
                    className="px-2 py-1 text-xs rounded text-white"
                    style={{ background: gabiTheme.colors.accent }}
                  >
                    Lista
                  </button>
                  {f.suggestedPages.includes('map') && (
                    <button
                      type="button"
                      disabled={generating !== null}
                      onClick={() => generate(f.schema, f.mainTable, 'map')}
                      className="px-2 py-1 text-xs rounded border"
                      style={{
                        borderColor: gabiTheme.colors.primary,
                        color: gabiTheme.colors.primary,
                      }}
                    >
                      Mapa
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                <td className="p-3 text-sm">
                  {t.geometryColumn ? (
                    <span className="text-green-700 block">{t.geometryColumn}</span>
                  ) : t.latitudeColumn && t.longitudeColumn ? (
                    <span className="text-green-700 block">
                      {t.latitudeColumn} + {t.longitudeColumn}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {t.geoSource && (
                    <span className="text-xs text-slate-500 block mt-0.5">{t.geoSource}</span>
                  )}
                </td>
                <td className="p-3">{odkLabel(t)}</td>
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
                  {t.suggestedPages.includes('report') && (
                    <button
                      type="button"
                      disabled={generating !== null}
                      onClick={() => generate(t.schema, t.name, 'report')}
                      className="px-2 py-1 text-xs rounded border"
                      style={{ borderColor: gabiTheme.colors.accent, color: gabiTheme.colors.accent }}
                    >
                      {generating === `${t.schema}.${t.name}.report` ? '...' : 'Relatório'}
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
