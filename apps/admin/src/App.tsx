import { Authenticated, Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router-v6';
import { BrowserRouter, Route, Routes, Outlet, Navigate } from 'react-router-dom';
import { authProvider } from './providers/authProvider';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { IntrospectPage } from './pages/IntrospectPage';
import { PagesListPage } from './pages/PagesListPage';
import { DynamicListPage } from './pages/DynamicListPage';
import { DynamicMapPage } from './pages/DynamicMapPage';
import { AuditPage } from './pages/AuditPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { LandingPage } from './pages/LandingPage';

function AuthenticatedLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Refine
        authProvider={authProvider}
        routerProvider={routerProvider}
        resources={[
          { name: 'dashboard', list: '/app' },
          { name: 'connections', list: '/connections' },
          { name: 'introspect', list: '/introspect' },
          { name: 'pages', list: '/pages' },
          { name: 'audit', list: '/audit' },
        ]}
        options={{ syncWithLocation: true }}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <Authenticated key="authenticated" fallback={<Navigate to="/login" replace />}>
                <AuthenticatedLayout />
              </Authenticated>
            }
          >
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/introspect" element={<IntrospectPage />} />
            <Route path="/pages" element={<PagesListPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/p/:resource/list" element={<DynamicListPage />} />
            <Route path="/p/:resource/map" element={<DynamicMapPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
