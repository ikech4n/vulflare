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
import type { VulnerabilityStats, EolStats } from '@vulflare/shared/types';

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
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>

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
          href="/vulnerabilities?severity=critical"
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">深刻度の分布</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={severityData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${String(value)}` : ''}
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">ステータス概要</h2>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">EOL管理サマリー</h2>
            <Link to="/eol" className="text-sm text-blue-600 hover:underline">
              詳細を見る
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{eolStats.total_products}</div>
              <div className="text-xs text-gray-600 mt-1">登録プロダクト</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{eolStats.eol_count}</div>
              <div className="text-xs text-gray-600 mt-1">EOL済み</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{eolStats.approaching_eol_30d}</div>
              <div className="text-xs text-gray-600 mt-1">30日以内EOL</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{eolStats.supported_count}</div>
              <div className="text-xs text-gray-600 mt-1">サポート中</div>
            </div>
          </div>
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
      className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:border-blue-300 transition-colors"
    >
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </Link>
  );
}
