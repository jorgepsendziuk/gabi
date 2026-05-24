import { useGetIdentity, useLogout } from '@refinedev/core';
import type { ReactNode } from 'react';
import { Button, tokens } from '@gabi/ui';
import { NavMenu } from './NavMenu';
import { useModules } from '../contexts/ModuleContext';

export function Layout({ children }: { children: ReactNode }) {
  const { data: identity } = useGetIdentity<{ name: string; email: string }>();
  const { mutate: logout } = useLogout();
  const { modules, activeModuleId, setActiveModuleId, activeModule } = useModules();

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="text-white px-6 py-4 flex items-center justify-between shadow-md"
        style={{ background: tokens.color.primary }}
      >
        <div className="flex items-center gap-4">
          <img src="/gabi.png" alt="GABI" className="h-10" />
          <div>
            <h1 className="text-lg font-bold tracking-wide">GABI Framework</h1>
            <p className="text-xs opacity-80">Geo-Aplicações &amp; Business Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="opacity-80 hidden sm:inline">Módulo:</span>
            <select
              className="text-slate-900 rounded px-2 py-1 text-sm min-w-[140px]"
              value={activeModuleId ?? ''}
              onChange={(e) => setActiveModuleId(e.target.value || null)}
            >
              <option value="">Todos os módulos</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon ? `${m.icon} ` : ''}
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {activeModule && (
            <span className="text-xs opacity-75 hidden md:inline">Menu: {activeModule.name}</span>
          )}
          <span>{identity?.name}</span>
          <Button type="button" variant="accent" size="sm" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-64 bg-white border-r border-slate-200 p-4 overflow-y-auto max-h-[calc(100vh-5rem)]">
          <NavMenu />
        </nav>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
