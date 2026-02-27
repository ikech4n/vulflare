import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldAlert, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api.ts';
import type { VulnerabilityStats, EolStats, EolTimelineItem } from '@vulflare/shared/types';

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#65a30d',
  informational: '#6b7280',
};

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['vulnerability-stats'],
    queryFn: () => api.get<VulnerabilityStats>('/vulnerabilities/stats').then((r) => r.data),
  });

  const { data: eolStats } = useQuery<EolStats>({
    queryKey: ['eol-stats'],
    queryFn: () => api.get('/eol/stats').then((r) => r.data),
  });

  const { data: eolTimeline } = useQuery<EolTimelineItem[]>({
    queryKey: ['eol-timeline'],
    queryFn: () => api.get('/eol/timeline').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-xl" /></div>;
  }

  if (!stats) return null;

  const severityData = Object.entries(stats.bySeverity).map(([name, value]) => ({ name, value }));
  const statusData = [
    { name: '対応中', value: stats.byStatus.active, color: '#3b82f6' },
    { name: '解決済み', value: stats.byStatus.fixed, color: '#22c55e' },
    { name: 'リスク受容', value: stats.byStatus.accepted_risk, color: '#a855f7' },
    { name: '誤検知', value: stats.byStatus.false_positive, color: '#6b7280' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ShieldAlert className="text-red-500" size={20} />}
          label="脆弱性の総数"
          value={stats.total}
          href="/vulnerabilities"
        />
        <StatCard
          icon={<AlertTriangle className="text-orange-500" size={20} />}
          label="Critical / High"
          value={(stats.bySeverity.critical ?? 0) + (stats.bySeverity.high ?? 0)}
          href="/vulnerabilities?severity=critical,high"
        />
        <StatCard
          icon={<Clock className="text-blue-500" size={20} />}
          label="対応中"
          value={stats.byStatus.active ?? 0}
          href="/vulnerabilities?status=active"
        />
        <StatCard
          icon={<CheckCircle2 className="text-green-500" size={20} />}
          label="解決済み（累計）"
          value={stats.byStatus.fixed ?? 0}
          href="/vulnerabilities?status=fixed"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">深刻度の分布</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
              <Pie
                data={severityData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                label={({ name, value, percent }) => value > 0 && percent >= 0.03 ? `${name}: ${String(value)}` : ''}
              >
                {severityData.map(({ name }) => (
                  <Cell
                    key={name}
                    fill={SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS] ?? '#ccc'}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">ステータス概要</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" name="Count">
                {statusData.map(({ name, color }) => (
                  <Cell key={name} fill={color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.recentlyAdded > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          過去7日間で <strong>{stats.recentlyAdded}</strong> 件の新しい脆弱性が検出されました。{' '}
          <Link to="/vulnerabilities" className="underline">今すぐ確認</Link>
        </div>
      )}

      {/* EOL Summary */}
      {eolStats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">EOL管理サマリー</h2>
            <Link to="/eol" className="text-sm text-blue-600 hover:underline">
              詳細を見る
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/eol" className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{eolStats.total_products}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">登録プロダクト</div>
            </Link>
            <Link to="/eol?status=eol" className="text-center p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
              <div className="text-2xl font-bold text-red-600">{eolStats.eol_count}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">EOL済み</div>
            </Link>
            <Link to="/eol?status=approaching_30d" className="text-center p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
              <div className="text-2xl font-bold text-orange-600">{eolStats.approaching_eol_30d}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">30日以内EOL</div>
            </Link>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{eolStats.supported_count}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">サポート中</div>
            </div>
          </div>

          {/* 近日EOL予定リスト */}
          {eolTimeline && eolTimeline.filter(item => item.days_until_eol <= 30).length > 0 && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs font-medium text-orange-700 mb-2">30日以内にEOLを迎えるバージョン</p>
              <ul className="space-y-1.5">
                {eolTimeline.filter(item => item.days_until_eol <= 30).slice(0, 5).map(item => (
                  <li key={`${item.product_name}-${item.cycle}`} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{item.display_name}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">{item.cycle}</span>
                    </span>
                    <span className={`text-xs font-medium ${item.days_until_eol <= 7 ? 'text-red-600' : 'text-orange-600'}`}>
                      {item.days_until_eol === 0 ? '本日' : `${item.days_until_eol}日後`} ({item.eol_date})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
    >
      <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </Link>
  );
}
