import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tokens } from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { useModules } from '../contexts/ModuleContext';

interface NavPage {
  id: string;
  type: string;
  resource: string;
  label: string;
  moduleId?: string;
}

const mainNav = [
  { to: '/app', label: 'Início', exact: true },
  { to: '/connections', label: 'Conexões' },
  { to: '/odk', label: 'ODK' },
  { to: '/introspect', label: 'Banco de dados' },
  { to: '/audit', label: 'Auditoria' },
];

function pagePath(p: NavPage): string {
  if (p.type === 'map') return `/p/${p.resource}/map`;
  if (p.type === 'report') return `/p/${p.resource}/report`;
  if (p.type === 'dashboard') return `/p/${p.resource}/dashboard`;
  return `/p/${p.resource}/list`;
}

function NavLinkItem({
  to,
  label,
  exact,
  indent,
}: {
  to: string;
  label: string;
  exact?: boolean;
  indent?: boolean;
}) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`block px-3 py-1.5 rounded text-sm truncate ${
        indent ? 'pl-6' : ''
      } ${active ? 'text-white font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
      style={active ? { background: tokens.color.accent } : undefined}
      title={label}
    >
      {label}
    </Link>
  );
}

export function NavMenu() {
  const location = useLocation();
  const { modules, activeModuleId } = useModules();
  const [pages, setPages] = useState<NavPage[]>([]);
  const [pagesOpen, setPagesOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<NavPage[]>('/api/generator/pages')
      .then(setPages)
      .catch(() => setPages([]));
  }, [location.pathname]);

  const pagesByModule = useMemo(() => {
    const map = new Map<string, NavPage[]>();
    for (const m of modules) map.set(m.id, []);
    const unassigned: NavPage[] = [];

    for (const p of pages) {
      if (p.moduleId && map.has(p.moduleId)) {
        map.get(p.moduleId)!.push(p);
      } else {
        unassigned.push(p);
      }
    }
    return { map, unassigned };
  }, [pages, modules]);

  const visibleModules = useMemo(() => {
    if (!activeModuleId) return modules;
    return modules.filter((m) => m.id === activeModuleId);
  }, [modules, activeModuleId]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      for (const m of visibleModules) next.add(m.id);
      return next;
    });
  }, [activeModuleId, visibleModules.length]);

  const pagesSectionActive =
    location.pathname === '/pages' ||
    location.pathname === '/modules' ||
    location.pathname.startsWith('/p/');

  return (
    <ul className="space-y-1">
      {mainNav.map((item) => (
        <li key={item.to}>
          <NavLinkItem to={item.to} label={item.label} exact={item.exact} />
        </li>
      ))}

      <li>
        <button
          type="button"
          onClick={() => setPagesOpen((o) => !o)}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center justify-between ${
            pagesSectionActive ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={pagesSectionActive ? { background: tokens.color.accent } : undefined}
        >
          <span>Páginas</span>
          <span className="text-xs opacity-80">{pagesOpen ? '▾' : '▸'}</span>
        </button>

        {pagesOpen && (
          <ul className="mt-1 space-y-0.5 border-l-2 border-slate-200 ml-2 pl-1">
            <li>
              <NavLinkItem to="/pages" label="Gerenciar páginas" indent />
            </li>
            <li>
              <NavLinkItem to="/modules" label="Módulos" indent />
            </li>

            {visibleModules.map((mod) => {
              const modPages = pagesByModule.map.get(mod.id) ?? [];
              const open = expandedModules.has(mod.id);
              return (
                <li key={mod.id}>
                  <button
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="w-full text-left pl-4 pr-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded flex items-center justify-between gap-1"
                    title={mod.description}
                  >
                    <span className="truncate">{mod.name}</span>
                    <span className="shrink-0 text-slate-400">
                      {open ? '▾' : '▸'} {modPages.length}
                    </span>
                  </button>
                  {open &&
                    modPages.map((p) => (
                      <div key={p.id} className="ml-2">
                        <NavLinkItem to={pagePath(p)} label={p.label} indent />
                      </div>
                    ))}
                </li>
              );
            })}

            {!activeModuleId && pagesByModule.unassigned.length > 0 && (
              <li>
                <p className="pl-4 py-1 text-xs text-slate-400">Sem módulo</p>
                {pagesByModule.unassigned.map((p) => (
                  <div key={p.id} className="ml-2">
                    <NavLinkItem to={pagePath(p)} label={p.label} indent />
                  </div>
                ))}
              </li>
            )}
          </ul>
        )}
      </li>
    </ul>
  );
}
