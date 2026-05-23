import { useGetIdentity, useLogout } from '@refinedev/core';
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Button, tokens } from '@gabi/ui';

const nav = [
  { to: '/app', label: 'Início' },
  { to: '/connections', label: 'Conexões' },
  { to: '/introspect', label: 'Banco de dados' },
  { to: '/pages', label: 'Páginas' },
  { to: '/audit', label: 'Auditoria' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { data: identity } = useGetIdentity<{ name: string; email: string }>();
  const { mutate: logout } = useLogout();
  const location = useLocation();

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
          <span>{identity?.name}</span>
          <Button type="button" variant="accent" size="sm" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-56 bg-white border-r border-slate-200 p-4">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`block px-3 py-2 rounded text-sm ${
                    location.pathname === item.to
                      ? 'text-white font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={
                    location.pathname === item.to
                      ? { background: tokens.color.accent }
                      : undefined
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
