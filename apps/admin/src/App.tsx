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
import { DynamicRecordDetailPage } from './pages/DynamicRecordDetailPage';
import { DynamicRecordFormPage } from './pages/DynamicRecordFormPage';
import { DynamicRecordReportPage } from './pages/DynamicRecordReportPage';
import { DynamicMapPage } from './pages/DynamicMapPage';
import { DynamicReportPage } from './pages/DynamicReportPage';
import { DynamicDashboardPage } from './pages/DynamicDashboardPage';
import { AuditPage } from './pages/AuditPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { OdkAdminPage } from './pages/OdkAdminPage';
import { LandingPage } from './pages/LandingPage';
import { ModulesPage } from './pages/ModulesPage';
import { ModuleProvider } from './contexts/ModuleContext';

function AuthenticatedLayout() {
  return (
    <ModuleProvider>
      <Layout>
        <Outlet />
      </Layout>
    </ModuleProvider>
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
          { name: 'odk', list: '/odk' },
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
            <Route path="/odk" element={<OdkAdminPage />} />
            <Route path="/introspect" element={<IntrospectPage />} />
            <Route path="/pages" element={<PagesListPage />} />
            <Route path="/modules" element={<ModulesPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/p/:resource/list" element={<DynamicListPage />} />
            <Route path="/p/:resource/record/:recordId" element={<DynamicRecordDetailPage />} />
            <Route
              path="/p/:resource/record/:recordId/edit"
              element={<DynamicRecordFormPage />}
            />
            <Route
              path="/p/:resource/record/:recordId/report/:reportResource"
              element={<DynamicRecordReportPage />}
            />
            <Route path="/p/:resource/map" element={<DynamicMapPage />} />
            <Route path="/p/:resource/report" element={<DynamicReportPage />} />
            <Route path="/p/:resource/dashboard" element={<DynamicDashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
