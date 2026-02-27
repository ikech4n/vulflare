import type { ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldAlert,
  RefreshCw,
  Settings,
  LogOut,
  User,
  Bell,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore.ts';
import { api } from '@/lib/api.ts';

interface NavChild {
  to: string;
  icon: ElementType;
  label: string;
}

interface NavItem {
  to: string;
  icon: ElementType;
  label: string;
  end?: boolean;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード', end: true },
  {
    to: '/vulnerabilities',
    icon: ShieldAlert,
    label: '脆弱性',
    children: [
      { to: '/sync', icon: RefreshCw, label: 'JVN取得' },
    ],
  },
  { to: '/eol', icon: Calendar, label: 'EOL 管理' },
  { to: '/notifications', icon: Bell, label: '通知' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
  }`;

export function Sidebar() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      logout();
      window.location.href = '/login';
    }
  };

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Vulflare</h1>
        <p className="text-xs text-gray-400 mt-0.5">脆弱性管理プラットフォーム</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end, children }) => (
          <div key={to}>
            <NavLink
              to={to}
              end={end}
              className={navLinkClass}
            >
              <Icon size={16} />
              {label}
            </NavLink>
            {children && (
              <div className="ml-4 mt-1 space-y-1">
                {children.map(({ to: childTo, icon: ChildIcon, label: childLabel }) => (
                  <NavLink
                    key={childTo}
                    to={childTo}
                    className={navLinkClass}
                  >
                    <ChildIcon size={16} />
                    {childLabel}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}

        {user?.role === 'admin' && (
          <NavLink
            to="/settings"
            className={navLinkClass}
          >
            <Settings size={16} />
            管理者設定
          </NavLink>
        )}
      </nav>

      <div className="p-3 border-t border-gray-700 space-y-1">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <User size={16} />
          <div className="min-w-0">
            <div className="font-medium truncate">{user?.username}</div>
            <div className="text-xs text-gray-400">
              {user?.role === 'admin' ? '管理者' : user?.role === 'editor' ? '編集者' : '閲覧者'}
            </div>
          </div>
        </NavLink>
        <button
          onClick={() => void handleLogout()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
