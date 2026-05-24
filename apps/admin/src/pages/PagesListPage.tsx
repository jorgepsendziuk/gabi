import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
} from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { useModules } from '../contexts/ModuleContext';

type PageType = 'list' | 'map' | 'report' | 'dashboard';
type PageScope = 'private' | 'global';

interface PageListItem {
  id: string;
  type: PageType;
  connectionId: string;
  dataSourceId: string;
  resource: string;
  label: string;
  scope: PageScope;
  ownerUserId?: string;
  config: Record<string, unknown>;
  createdAt: string;
  schema: string;
  table: string;
  connectionName: string;
  moduleId?: string;
  moduleName?: string;
  geometryColumn?: string;
}

interface Connection {
  id: string;
  name: string;
  isDefault: boolean;
}

interface TableInfo {
  schema: string;
  name: string;
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
  geoSource?: string;
  suggestedPages: string[];
}

type TypeFilter = 'all' | PageType;
type ScopeFilter = 'all' | PageScope;
type SortMode = 'newest' | 'label' | 'table';

function ScopeBadge({ scope }: { scope: PageScope }) {
  if (scope === 'private') {
    return <Badge variant="default">Minha</Badge>;
  }
  return <Badge variant="info">Aberta a todos</Badge>;
}

function pageHref(p: PageListItem): string {
  if (p.type === 'map') return `/p/${p.resource}/map`;
  if (p.type === 'report') return `/p/${p.resource}/report`;
  if (p.type === 'dashboard') return `/p/${p.resource}/dashboard`;
  return `/p/${p.resource}/list`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PageTypeBadge({ type }: { type: PageType }) {
  const label =
    type === 'map'
      ? 'Mapa'
      : type === 'report'
        ? 'Relatório'
        : type === 'dashboard'
          ? 'Dashboard'
          : 'Lista';
  const variant =
    type === 'map'
      ? 'info'
      : type === 'report'
        ? 'default'
        : type === 'dashboard'
          ? 'accent'
          : 'accent';
  return <Badge variant={variant}>{label}</Badge>;
}

function PageCard({
  page,
  onRename,
  onChangeScope,
  onChangeModule,
  onDelete,
}: {
  page: PageListItem;
  onRename: (p: PageListItem) => void;
  onChangeScope: (p: PageListItem) => void;
  onChangeModule: (p: PageListItem) => void;
  onDelete: (p: PageListItem) => void;
}) {
  return (
    <Card padding="md" hover className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          <PageTypeBadge type={page.type} />
          <ScopeBadge scope={page.scope} />
        </div>
        {page.geometryColumn && (
          <span className="text-xs text-gabi-muted" title="Coluna geométrica">
            geo: {page.geometryColumn}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-gabi-primary m-0 text-base leading-snug">{page.label}</h3>
      <p className="font-mono text-sm text-gabi-muted mt-1 mb-0">
        {page.schema}.{page.table}
      </p>
      <p className="text-xs text-gabi-muted mt-2 mb-0">
        {page.connectionName}
        {page.moduleName ? ` · ${page.moduleName}` : ''}
      </p>
      <p className="text-xs text-gabi-muted mt-1 mb-0 truncate" title={page.resource}>
        {page.resource}
      </p>
      <p className="text-xs text-gabi-muted mt-3 mb-0">Criada em {formatDate(page.createdAt)}</p>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--gabi-border)] mt-auto">
        <Link to={pageHref(page)} className="gabi-btn gabi-btn--accent gabi-btn--sm flex-1 min-w-[5rem]">
          Abrir
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={() => onRename(page)}>
          Renomear
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChangeScope(page)}>
          Escopo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChangeModule(page)}>
          Módulo
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(page)}>
          Excluir
        </Button>
      </div>
    </Card>
  );
}

function CreatePageModal({
  connections,
  existingPages,
  defaultModuleId,
  onClose,
  onCreated,
}: {
  connections: Connection[];
  existingPages: PageListItem[];
  defaultModuleId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { modules } = useModules();
  const defaultConn = connections.find((c) => c.isDefault) ?? connections[0];
  const [connectionId, setConnectionId] = useState(defaultConn?.id ?? '');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableKey, setTableKey] = useState('');
  const [template, setTemplate] = useState<PageType>('list');
  const [scope, setScope] = useState<PageScope>('global');
  const [moduleId, setModuleId] = useState(
    defaultModuleId ?? modules.find((m) => m.id === 'mod_default')?.id ?? modules[0]?.id ?? '',
  );
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedTable = useMemo(() => {
    if (!tableKey) return null;
    const [schema, name] = tableKey.split('|');
    return tables.find((t) => t.schema === schema && t.name === name) ?? null;
  }, [tableKey, tables]);

  const canMap = Boolean(
    selectedTable?.geometryColumn ||
      (selectedTable?.latitudeColumn && selectedTable?.longitudeColumn) ||
      selectedTable?.suggestedPages.includes('map'),
  );

  const duplicate = useMemo(() => {
    if (!selectedTable || !connectionId) return false;
    return existingPages.some(
      (p) =>
        p.connectionId === connectionId &&
        p.schema === selectedTable.schema &&
        p.table === selectedTable.name &&
        p.type === template,
    );
  }, [existingPages, selectedTable, connectionId, template]);

  useEffect(() => {
    if (!connectionId) {
      setTables([]);
      return;
    }
    setLoadingTables(true);
    setTableKey('');
    apiFetch<{ tables: TableInfo[] }>(`/api/introspect?connectionId=${connectionId}`)
      .then((r) => setTables(r.tables))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [connectionId]);

  useEffect(() => {
    if (template === 'map' && !canMap) setTemplate('list');
  }, [canMap, template]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || duplicate) return;
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/generator/pages', {
        method: 'POST',
        body: JSON.stringify({
          connectionId,
          schema: selectedTable.schema,
          table: selectedTable.name,
          template,
          label: label.trim() || undefined,
          scope,
          moduleId: moduleId || 'mod_default',
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-page-title"
    >
      <Card padding="lg" className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="create-page-title" className="text-lg font-bold text-gabi-primary m-0">
              Nova página
            </h2>
            <p className="text-sm text-gabi-muted mt-1 mb-0">
              Escolha conexão, tabela e tipo de interface.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gabi-muted hover:text-gabi-primary text-xl leading-none p-1"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          {duplicate && (
            <Alert variant="warning">
              Já existe uma página{' '}
              {template === 'map'
                ? 'de mapa'
                : template === 'report'
                  ? 'de relatório'
                  : template === 'dashboard'
                    ? 'de dashboard'
                    : 'de lista'}{' '}
              para esta tabela.
            </Alert>
          )}

          <Field label="Módulo" required>
            <select
              className="gabi-select"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              required
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Conexão" required>
            <select
              className="gabi-select"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              required
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tabela" required>
            <select
              className="gabi-select"
              value={tableKey}
              onChange={(e) => setTableKey(e.target.value)}
              required
              disabled={loadingTables || tables.length === 0}
            >
              <option value="">
                {loadingTables
                  ? 'Carregando tabelas…'
                  : tables.length === 0
                    ? 'Nenhuma tabela encontrada'
                    : 'Selecione uma tabela'}
              </option>
              {tables.map((t) => (
                <option key={`${t.schema}|${t.name}`} value={`${t.schema}|${t.name}`}>
                  {t.schema}.{t.name}
                  {t.geometryColumn || (t.latitudeColumn && t.longitudeColumn) ? ' (geo)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <span className="gabi-label">Tipo de página</span>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                className={`gabi-btn gabi-btn--sm ${template === 'list' ? 'gabi-btn--accent' : 'gabi-btn--outline'}`}
                onClick={() => setTemplate('list')}
              >
                Lista
              </button>
              <button
                type="button"
                disabled={!canMap}
                title={!canMap ? 'Tabela sem geometria' : undefined}
                className={`gabi-btn gabi-btn--sm ${template === 'map' ? 'gabi-btn--primary' : 'gabi-btn--outline'}`}
                onClick={() => setTemplate('map')}
              >
                Mapa
              </button>
              <button
                type="button"
                className={`gabi-btn gabi-btn--sm ${template === 'report' ? 'gabi-btn--accent' : 'gabi-btn--outline'}`}
                onClick={() => setTemplate('report')}
              >
                Relatório
              </button>
              <button
                type="button"
                className={`gabi-btn gabi-btn--sm ${template === 'dashboard' ? 'gabi-btn--primary' : 'gabi-btn--outline'}`}
                onClick={() => setTemplate('dashboard')}
              >
                Dashboard
              </button>
            </div>
          </div>

          <Field label="Rótulo (opcional)">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                selectedTable
                  ? template === 'map'
                    ? `Mapa: ${selectedTable.schema}.${selectedTable.name}`
                    : template === 'report'
                      ? `Relatório: ${selectedTable.schema}.${selectedTable.name}`
                      : template === 'dashboard'
                        ? `Dashboard: ${selectedTable.schema}.${selectedTable.name}`
                        : `Lista: ${selectedTable.schema}.${selectedTable.name}`
                  : 'Usar nome padrão'
              }
            />
          </Field>

          <div>
            <span className="gabi-label">Escopo</span>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                className={`gabi-btn gabi-btn--sm ${scope === 'global' ? 'gabi-btn--accent' : 'gabi-btn--outline'}`}
                onClick={() => setScope('global')}
              >
                Aberta a todos
              </button>
              <button
                type="button"
                className={`gabi-btn gabi-btn--sm ${scope === 'private' ? 'gabi-btn--primary' : 'gabi-btn--outline'}`}
                onClick={() => setScope('private')}
              >
                Minha (só você)
              </button>
            </div>
            <p className="text-xs text-gabi-muted mt-2 mb-0">
              {scope === 'private'
                ? 'Somente você verá e acessará esta página.'
                : 'Qualquer usuário autenticado poderá ver e abrir.'}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="accent"
              className="flex-1"
              disabled={submitting || !selectedTable || duplicate}
            >
              {submitting ? 'Criando…' : 'Criar página'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function PagesListPage() {
  const { modules, activeModuleId } = useModules();
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>(activeModuleId ?? 'all');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [filterScope, setFilterScope] = useState<ScopeFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');

  const loadPages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterConnection !== 'all') params.set('connectionId', filterConnection);
      if (filterModule !== 'all') params.set('moduleId', filterModule);
      const q = params.toString() ? `?${params}` : '';
      const list = await apiFetch<PageListItem[]>(`/api/generator/pages${q}`);
      setPages(list);
    } catch (e) {
      setError(String(e));
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [filterConnection, filterModule]);

  useEffect(() => {
    if (activeModuleId) setFilterModule(activeModuleId);
  }, [activeModuleId]);

  useEffect(() => {
    apiFetch<Connection[]>('/api/connections')
      .then(setConnections)
      .catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pages.filter((p) => {
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (filterScope !== 'all' && p.scope !== filterScope) return false;
      if (!q) return true;
      const hay = `${p.label} ${p.resource} ${p.schema}.${p.table} ${p.connectionName}`.toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sort === 'label') return a.label.localeCompare(b.label, 'pt-BR');
      if (sort === 'table') {
        const ta = `${a.schema}.${a.table}`;
        const tb = `${b.schema}.${b.table}`;
        return ta.localeCompare(tb, 'pt-BR');
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [pages, filterType, filterScope, search, sort]);

  const stats = useMemo(() => {
    const list = filtered;
    return {
      total: list.length,
      lists: list.filter((p) => p.type === 'list').length,
      maps: list.filter((p) => p.type === 'map').length,
      reports: list.filter((p) => p.type === 'report').length,
    };
  }, [filtered]);

  const handleChangeScope = async (page: PageListItem) => {
    const next =
      page.scope === 'private'
        ? 'global'
        : window.confirm(
            'Tornar esta página privada? Somente você poderá vê-la e acessá-la.',
          )
          ? 'private'
          : null;
    if (!next || next === page.scope) return;
    try {
      await apiFetch(`/api/generator/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scope: next }),
      });
      loadPages();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleChangeModule = async (page: PageListItem) => {
    const options = modules.map((m) => `${m.id}:${m.name}`).join('\n');
    const pick = window.prompt(
      `Módulo atual: ${page.moduleName ?? '—'}\n\nInforme o ID do novo módulo:\n${options}`,
      page.moduleId ?? 'mod_default',
    );
    if (!pick?.trim() || pick === page.moduleId) return;
    try {
      await apiFetch(`/api/generator/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ moduleId: pick.trim() }),
      });
      loadPages();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleRename = async (page: PageListItem) => {
    const next = window.prompt('Novo rótulo da página:', page.label);
    if (!next?.trim() || next.trim() === page.label) return;
    try {
      await apiFetch(`/api/generator/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: next.trim() }),
      });
      loadPages();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleDelete = async (page: PageListItem) => {
    if (
      !window.confirm(
        `Excluir "${page.label}"?\n\nA página e permissões associadas serão removidas.`,
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/generator/pages/${page.id}`, { method: 'DELETE' });
      loadPages();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Páginas"
        description="Interfaces geradas a partir das tabelas — listas, mapas, relatórios e dashboards com editor drag-and-drop."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => loadPages()}>
              Atualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={connections.length === 0}
              onClick={async () => {
                const conn = connections.find((c) => c.isDefault) ?? connections[0];
                if (!conn) return;
                try {
                  await apiFetch('/api/generator/dashboards', {
                    method: 'POST',
                    body: JSON.stringify({
                      connectionId: conn.id,
                      moduleId: activeModuleId ?? 'mod_default',
                    }),
                  });
                  loadPages();
                } catch (e) {
                  alert(String(e));
                }
              }}
            >
              Novo dashboard
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => setShowCreate(true)}
              disabled={connections.length === 0}
            >
              Nova página
            </Button>
          </>
        }
      />

      {connections.length === 0 && (
        <Alert variant="info" className="mb-4">
          Cadastre uma conexão em{' '}
          <Link to="/connections" className="underline font-medium">
            Conexões
          </Link>{' '}
          antes de criar páginas.
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card padding="md" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Field label="Buscar" className="!mb-0 sm:col-span-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rótulo, tabela, recurso…"
            />
          </Field>
          <Field label="Módulo" className="!mb-0">
            <select
              className="gabi-select"
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
            >
              <option value="all">Todos</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Conexão" className="!mb-0">
            <select
              className="gabi-select"
              value={filterConnection}
              onChange={(e) => setFilterConnection(e.target.value)}
            >
              <option value="all">Todas</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo" className="!mb-0">
            <select
              className="gabi-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TypeFilter)}
            >
              <option value="all">Todos</option>
              <option value="list">Listas</option>
              <option value="map">Mapas</option>
              <option value="report">Relatórios</option>
              <option value="dashboard">Dashboards</option>
            </select>
          </Field>
          <Field label="Escopo" className="!mb-0">
            <select
              className="gabi-select"
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as ScopeFilter)}
            >
              <option value="all">Todos</option>
              <option value="global">Abertas a todos</option>
              <option value="private">Minhas</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--gabi-border)]">
          <p className="text-sm text-gabi-muted m-0">
            {stats.total} página{stats.total !== 1 ? 's' : ''}
            {stats.total > 0 && (
              <>
                {' '}
                · {stats.lists} lista{stats.lists !== 1 ? 's' : ''} · {stats.maps} mapa
                {stats.maps !== 1 ? 's' : ''} · {stats.reports} relatório
                {stats.reports !== 1 ? 's' : ''}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gabi-muted">Ordenar:</label>
            <select
              className="gabi-select !w-auto min-w-[10rem]"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="newest">Mais recentes</option>
              <option value="label">Rótulo (A–Z)</option>
              <option value="table">Tabela (A–Z)</option>
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="text-gabi-muted text-sm">Carregando páginas…</p>
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-gabi-muted m-0 mb-4">
            {pages.length === 0
              ? 'Nenhuma página criada ainda.'
              : 'Nenhum resultado com os filtros atuais.'}
          </p>
          {pages.length === 0 && connections.length > 0 && (
            <Button type="button" variant="accent" onClick={() => setShowCreate(true)}>
              Criar primeira página
            </Button>
          )}
          {pages.length > 0 && (
            <Button type="button" variant="outline" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PageCard
              key={p.id}
              page={p}
              onRename={handleRename}
              onChangeScope={handleChangeScope}
              onChangeModule={handleChangeModule}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && connections.length > 0 && (
        <CreatePageModal
          connections={connections}
          existingPages={pages}
          defaultModuleId={activeModuleId}
          onClose={() => setShowCreate(false)}
          onCreated={loadPages}
        />
      )}
    </div>
  );
}
