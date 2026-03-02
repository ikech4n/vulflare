import type { ElementType } from 'react';
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldAlert,
  Settings,
  LogOut,
  User,
  Users,
  Bell,
  Calendar,
  Database,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore.ts';
import { api } from '@/lib/api.ts';

interface NavChild {
  to: string;
  icon: ElementType;
  label: string;
  end?: boolean;
  adminOnly?: boolean;
}

type NavItem =
  | { to: string; icon: ElementType; label: string; end?: boolean; children?: never; minRole?: never }
  | { to?: never; icon: ElementType; label: string; end?: never; children: NavChild[]; minRole?: 'admin' | 'editor' };

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード', end: true },
  { to: '/vulnerabilities?status=new,open', icon: ShieldAlert, label: '脆弱性一覧' },
  { to: '/eol', icon: Calendar, label: 'EOL管理' },
  {
    icon: Settings,
    label: '設定',
    minRole: 'editor',
    children: [
      { to: '/data-sources', icon: Database, label: 'データソース' },
      { to: '/notifications', icon: Bell, label: '通知' },
      { to: '/users', icon: Users, label: 'ユーザー', adminOnly: true },
    ],
  },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
  }`;

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isEditorOrAbove = user?.role === 'admin' || user?.role === 'editor';

  const isChildActive = (children: NavChild[]) =>
    children.some(({ to }) => location.pathname.startsWith(to));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of NAV_ITEMS) {
      if (item.children) {
        initial[item.label] = isChildActive(item.children);
      }
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of NAV_ITEMS) {
        if (item.children && isChildActive(item.children)) {
          next[item.label] = true;
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      logout();
      window.location.href = '/login';
    }
  };

  return (
    <aside className="w-56 h-screen sticky top-0 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          <span className="text-orange-500">V</span>ulflare
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">脆弱性管理プラットフォーム</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.filter((item) => {
          if (item.minRole === 'admin') return isAdmin;
          if (item.minRole === 'editor') return isEditorOrAbove;
          return true;
        }).map((item) => (
          <div key={item.label}>
            {item.to !== undefined ? (
              <NavLink to={item.to} end={item.end} className={navLinkClass}>
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ) : (
              <>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <item.icon size={16} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {openGroups[item.label]
                    ? <ChevronDown size={14} />
                    : <ChevronRight size={14} />}
                </button>
                {openGroups[item.label] && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children
                      .filter(({ adminOnly }) => !adminOnly || isAdmin)
                      .map(({ to, icon: ChildIcon, label, end }) => (
                        <NavLink key={to} to={to} end={end} className={navLinkClass}>
                          <ChildIcon size={16} />
                          {label}
                        </NavLink>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-zinc-800 space-y-1">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          <User size={16} />
          <div className="min-w-0">
            <div className="font-medium truncate">{user?.username}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {user?.role === 'admin' ? '管理者' : user?.role === 'editor' ? '編集者' : '閲覧者'}
            </div>
          </div>
        </NavLink>
        <button
          onClick={() => void handleLogout()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
