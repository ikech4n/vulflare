import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api.ts';
import type { SlaPolicy, SlaBreach, SlaSummary } from '@vulflare/shared/types';

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'クリティカル',
  high: '高',
  medium: '中',
  low: '低',
  informational: '情報',
};

export function SlaPage() {
  const queryClient = useQueryClient();
  const [editingSeverity, setEditingSeverity] = useState<string | null>(null);
  const [editDays, setEditDays] = useState(0);

  // SLAポリシー一覧
  const { data: policies = [] } = useQuery<SlaPolicy[]>({
    queryKey: ['sla', 'policies'],
    queryFn: async () => {
      const res = await api.get('/sla/policies');
      return res.data;
    },
  });

  // SLA違反一覧
  const { data: breaches = [] } = useQuery<SlaBreach[]>({
    queryKey: ['sla', 'breaches'],
    queryFn: async () => {
      const res = await api.get('/sla/breaches');
      return res.data;
    },
  });

  // SLAサマリー
  const { data: summary } = useQuery<SlaSummary>({
    queryKey: ['sla', 'summary'],
    queryFn: async () => {
      const res = await api.get('/sla/summary');
      return res.data;
    },
  });

  // ポリシー更新
  const updatePolicyMutation = useMutation({
    mutationFn: async ({ severity, responseDays }: { severity: string; responseDays: number }) => {
      await api.put(`/sla/policies/${severity}`, { responseDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla'] });
      setEditingSeverity(null);
    },
  });

  const handleEdit = (policy: SlaPolicy) => {
    setEditingSeverity(policy.severity);
    setEditDays(policy.response_days);
  };

  const handleSave = () => {
    if (editingSeverity) {
      updatePolicyMutation.mutate({ severity: editingSeverity, responseDays: editDays });
    }
  };

  const handleCancel = () => {
    setEditingSeverity(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SLA 追跡</h1>
        <p className="text-gray-600 mt-1">脆弱性対応の SLA（サービスレベル合意）を管理します</p>
      </div>

      {/* サマリーカード */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">総数</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA 遵守中</p>
                <p className="text-2xl font-bold text-green-600">{summary.within_sla}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA 違反</p>
                <p className="text-2xl font-bold text-red-600">{summary.breached}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA 未設定</p>
                <p className="text-2xl font-bold text-gray-600">{summary.no_sla}</p>
              </div>
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* SLAポリシー設定 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">SLA ポリシー設定</h2>
          <p className="text-sm text-gray-600 mt-1">重大度別の対応期限を設定します</p>
        </div>

        <div className="p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">重大度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">対応期限（日）</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {policies.map((policy) => (
                <tr key={policy.severity}>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(policy.severity)}`}>
                      {SEVERITY_LABELS[policy.severity]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {editingSeverity === policy.severity ? (
                      <input
                        type="number"
                        min="0"
                        value={editDays}
                        onChange={(e) => setEditDays(Number(e.target.value))}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-md"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">{policy.response_days} 日</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {editingSeverity === policy.severity ? (
                      <div className="space-x-2">
                        <button
                          onClick={handleSave}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(policy)}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA違反一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">SLA 違反</h2>
          <p className="text-sm text-gray-600 mt-1">期限を超過した脆弱性の一覧</p>
        </div>

        {breaches.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p>SLA 違反はありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">アセット</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">脆弱性</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">重大度</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">期限</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">超過日数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {breaches.map((breach, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{breach.asset_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{breach.vulnerability_title}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(breach.severity)}`}>
                        {SEVERITY_LABELS[breach.severity]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {new Date(breach.sla_deadline).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
                        {breach.days_overdue} 日超過
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-purple-100 text-purple-800';
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-orange-100 text-orange-800';
    case 'low':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
