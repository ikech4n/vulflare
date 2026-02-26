import { createBrowserRouter } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout.tsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout.tsx';
import { ProtectedRoute } from '@/components/ProtectedRoute.tsx';
import { LoginPage } from '@/pages/auth/LoginPage.tsx';
import { RegisterPage } from '@/pages/auth/RegisterPage.tsx';
import { DashboardPage } from '@/pages/DashboardPage.tsx';
import { VulnerabilitiesPage } from '@/pages/VulnerabilitiesPage.tsx';
import { VulnerabilityDetailPage } from '@/pages/VulnerabilityDetailPage.tsx';
import { VulnerabilityCreatePage } from '@/pages/VulnerabilityCreatePage.tsx';
import { AssetsPage } from '@/pages/AssetsPage.tsx';
import { AssetDetailPage } from '@/pages/AssetDetailPage.tsx';
import { SyncPage } from '@/pages/SyncPage.tsx';
import { SettingsPage } from '@/pages/SettingsPage.tsx';
import { ProfilePage } from '@/pages/ProfilePage.tsx';
import { SlaPage } from '@/pages/SlaPage.tsx';
import { NotificationsPage } from '@/pages/NotificationsPage.tsx';
import { EolPage } from '@/pages/EolPage.tsx';
import { EolProductDetailPage } from '@/pages/EolProductDetailPage.tsx';
import { AssetTemplatesPage } from '@/pages/AssetTemplatesPage.tsx';
import { AssetTemplateFormPage } from '@/pages/AssetTemplateFormPage.tsx';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/vulnerabilities', element: <VulnerabilitiesPage /> },
      { path: '/vulnerabilities/new', element: <VulnerabilityCreatePage /> },
      { path: '/vulnerabilities/:id', element: <VulnerabilityDetailPage /> },
      { path: '/assets', element: <AssetsPage /> },
      { path: '/assets/:id', element: <AssetDetailPage /> },
      { path: '/asset-templates', element: <AssetTemplatesPage /> },
      { path: '/asset-templates/:id', element: <AssetTemplateFormPage /> },
      { path: '/sync', element: <SyncPage /> },
      { path: '/sla', element: <SlaPage /> },
      { path: '/eol', element: <EolPage /> },
      { path: '/eol/products/:id', element: <EolProductDetailPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
]);
