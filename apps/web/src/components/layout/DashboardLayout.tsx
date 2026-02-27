import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto dark:bg-gray-950">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
