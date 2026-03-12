import { ProtectedRoute } from "@/components/ProtectedRoute.tsx";
import { AuthLayout } from "@/components/layout/AuthLayout.tsx";
import { DashboardLayout } from "@/components/layout/DashboardLayout.tsx";
import { DashboardPage } from "@/pages/DashboardPage.tsx";
import { EolPage } from "@/pages/EolPage.tsx";
import { EolProductDetailPage } from "@/pages/EolProductDetailPage.tsx";
import { NotificationsPage } from "@/pages/NotificationsPage.tsx";
import { ProfilePage } from "@/pages/ProfilePage.tsx";
import { SettingsPage } from "@/pages/SettingsPage.tsx";
import { SyncPage } from "@/pages/SyncPage.tsx";
import { VulnerabilitiesPage } from "@/pages/VulnerabilitiesPage.tsx";
import { VulnerabilityCreatePage } from "@/pages/VulnerabilityCreatePage.tsx";
import { VulnerabilityDetailPage } from "@/pages/VulnerabilityDetailPage.tsx";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage.tsx";
import { LoginPage } from "@/pages/auth/LoginPage.tsx";
import { RegisterPage } from "@/pages/auth/RegisterPage.tsx";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage.tsx";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/vulnerabilities", element: <VulnerabilitiesPage /> },
      { path: "/vulnerabilities/new", element: <VulnerabilityCreatePage /> },
      { path: "/vulnerabilities/:id", element: <VulnerabilityDetailPage /> },
      { path: "/data-sources", element: <SyncPage /> },
      { path: "/eol", element: <EolPage /> },
      { path: "/eol/products/:id", element: <EolProductDetailPage /> },
      { path: "/notifications", element: <NotificationsPage /> },
      { path: "/users", element: <SettingsPage /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
]);
