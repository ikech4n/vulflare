import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { useAuthStore } from '@/store/authStore.ts';

interface SyncStatus {
  lastSyncDate: string | null;
  latestLog: {
    id: string;
    sync_type: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    total_fetched: number;
    total_created: number;
    error_message: string | null;
  } | null;
}

const SYNC_STATUS_LABELS: Record<string, string> = {
  running: '実行中',
  completed: '完了',
  failed: '失敗',
  cancelled: 'キャンセル済み',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  running: <Clock size={18} className="text-blue-500 animate-spin" />,
  completed: <CheckCircle size={18} className="text-green-500" />,
  failed: <XCircle size={18} className="text-red-500" />,
  cancelled: <Ban size={18} className="text-yellow-500" />,
};

export function JvnSyncPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['jvn-sync-status'],
    queryFn: () => api.get<SyncStatus>('/jvn/sync/status').then((r) => r.data),
    refetchInterval: 10000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.post('/jvn/sync/trigger'),
    onSuccess: () => {
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['jvn-sync-status'] }), 2000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post('/sync/cancel', { source: 'jvn' }),
    onSuccess: () => {
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['jvn-sync-status'] }), 3000);
    },
  });

  const log = data?.latestLog;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">JVN取得</h1>
          <p className="text-sm text-gray-500 mt-1">JVN iPedia (MyJVN API) から脆弱性情報を取得します</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {log?.status === 'running' && (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                <Ban size={16} />
                {cancelMutation.isPending ? 'キャンセル中...' : 'キャンセル'}
              </button>
            )}
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending || log?.status === 'running'}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={triggerMutation.isPending ? 'animate-spin' : ''} />
              取得を実行
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">読み込み中...</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">ステータス</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">前回の取得</span>
                <span className="text-gray-900">
                  {data?.lastSyncDate
                    ? new Date(data.lastSyncDate).toLocaleString('ja-JP')
                    : '未実行'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">スケジュール</span>
                <span className="text-gray-900">毎日 16:00 UTC（01:00 JST）</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">データソース</span>
                <a
                  href="https://jvndb.jvn.jp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  JVN iPedia (JPCERT/CC・IPA)
                </a>
              </div>
            </div>
          </div>

          {log && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">最新の実行</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {STATUS_ICON[log.status] ?? <Clock size={18} />}
                  <span className="font-medium">{SYNC_STATUS_LABELS[log.status] ?? log.status}</span>
                  <span className="text-gray-400 capitalize ml-1">({log.sync_type})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">開始</span>
                  <span className="text-gray-900">{new Date(log.started_at).toLocaleString('ja-JP')}</span>
                </div>
                {log.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">完了</span>
                    <span className="text-gray-900">{new Date(log.completed_at).toLocaleString('ja-JP')}</span>
                  </div>
                )}
                {log.status === 'completed' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">取得件数</span>
                      <span className="text-gray-900">{log.total_fetched.toLocaleString()} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">新規 / 更新</span>
                      <span className="text-gray-900">{log.total_created.toLocaleString()}</span>
                    </div>
                  </>
                )}
                {log.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs font-mono">
                    {log.error_message}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isAdmin && (
            <p className="text-xs text-gray-500">管理者のみ手動取得を実行できます。</p>
          )}
        </div>
      )}
    </div>
  );
}
