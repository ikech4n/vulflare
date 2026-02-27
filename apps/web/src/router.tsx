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
import { SyncPage } from '@/pages/SyncPage.tsx';
import { SettingsPage } from '@/pages/SettingsPage.tsx';
import { ProfilePage } from '@/pages/ProfilePage.tsx';
import { NotificationsPage } from '@/pages/NotificationsPage.tsx';
import { EolPage } from '@/pages/EolPage.tsx';
import { EolProductDetailPage } from '@/pages/EolProductDetailPage.tsx';

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
      { path: '/sync', element: <SyncPage /> },
      { path: '/eol', element: <EolPage /> },
      { path: '/eol/products/:id', element: <EolProductDetailPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
]);
