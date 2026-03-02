import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, KeyRound, Pencil, LockOpen, Mail } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { useAuthStore } from '@/store/authStore.ts';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理者',
  editor: '編集者',
  viewer: '閲覧者',
};

interface UserItem {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  lockedAt: string | null;
  email: string | null;
  createdAt: string;
}


export function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // メール設定
  const [editingEmail, setEditingEmail] = useState(false);
  const [noreplyEmailInput, setNoreplyEmailInput] = useState('');

  // パスワードリセット
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwError, setResetPwError] = useState('');

  // ユーザー情報編集
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');

  // ユーザー追加フォーム
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('viewer');
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: () => api.get<UserItem[]>('/users').then((r) => r.data),
    enabled: user?.role === 'admin',
  });

  const { data: appSettings } = useQuery<{ noreplyEmail: string | null }>({
    queryKey: ['app-settings'],
    queryFn: () => api.get<{ noreplyEmail: string | null }>('/app-settings').then((r) => r.data),
    enabled: user?.role === 'admin',
  });

  const updateAppSettingsMutation = useMutation({
    mutationFn: (body: { noreplyEmail: string }) => api.patch('/app-settings', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      setEditingEmail(false);
    },
  });


  const addUserMutation = useMutation({
    mutationFn: (body: { username: string; password: string; role: string; email?: string }) =>
      api.post('/users', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setAddUsername('');
      setAddPassword('');
      setAddRole('viewer');
      setAddEmail('');
      setAddError('');
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? 'ユーザーの追加に失敗しました');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/users/${id}`, { role }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, username, email }: { id: string; username: string; email: string }) =>
      api.patch(`/users/${id}`, { username, email: email || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUserId(null);
      setEditUsername('');
      setEditEmail('');
      setEditError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEditError(msg ?? '更新に失敗しました');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      setResetPwUserId(null);
      setResetPwValue('');
      setResetPwError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setResetPwError(msg ?? 'パスワードのリセットに失敗しました');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/unlock`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleAddUser = (e: FormEvent) => {
    e.preventDefault();
    setAddError('');
    addUserMutation.mutate({ username: addUsername, password: addPassword, role: addRole, ...(addEmail ? { email: addEmail } : {}) });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">管理者設定</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">この画面は管理者のみ利用できます。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">管理者設定</h1>

      {/* Email settings */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Mail size={16} />
          メール設定
        </h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">パスワードリセットメールの送信元アドレス</p>
            {editingEmail ? (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={noreplyEmailInput}
                  onChange={(e) => setNoreplyEmailInput(e.target.value)}
                  placeholder="noreply@example.com"
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={() => updateAppSettingsMutation.mutate({ noreplyEmail: noreplyEmailInput })}
                  disabled={!noreplyEmailInput || updateAppSettingsMutation.isPending}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                >
                  {updateAppSettingsMutation.isPending ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditingEmail(false)}
                  className="px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-900 dark:text-white font-mono">
                  {appSettings?.noreplyEmail ?? <span className="text-gray-400 italic">未設定</span>}
                </span>
                <button
                  onClick={() => {
                    setNoreplyEmailInput(appSettings?.noreplyEmail ?? '');
                    setEditingEmail(true);
                  }}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  変更
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add user */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
          <UserPlus size={16} />
          ユーザーを追加
        </h2>
        <form onSubmit={handleAddUser} className="space-y-3" autoComplete="off">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">ユーザー名</label>
              <input
                type="text"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                required
                autoComplete="off"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">パスワード</label>
              <input
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">ロール</label>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="viewer">閲覧者</option>
                <option value="editor">編集者</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">メールアドレス（任意）</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                autoComplete="off"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="example@example.com"
              />
            </div>
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          {addSuccess && <p className="text-sm text-green-600">ユーザーを追加しました</p>}
          <button
            type="submit"
            disabled={addUserMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {addUserMutation.isPending ? '追加中...' : 'ユーザーを追加'}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">ユーザー</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.username}</p>
                  {u.lockedAt && (
                    <span className="text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded">
                      ロック中
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => {
                      if (editUserId === u.id) {
                        setEditUserId(null);
                        setEditError('');
                      } else {
                        setEditUserId(u.id);
                        setEditUsername(u.username);
                        setEditEmail(u.email ?? '');
                        setEditError('');
                        setResetPwUserId(null);
                      }
                    }}
                    className={`p-1 transition-colors ${editUserId === u.id ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                    title="ユーザー情報を編集"
                  >
                    <Pencil size={14} />
                  </button>
                  {u.lockedAt && (
                    <button
                      onClick={() => unlockMutation.mutate(u.id)}
                      disabled={unlockMutation.isPending}
                      className="p-1 text-red-500 hover:text-green-600 transition-colors disabled:opacity-50"
                      title="ロック解除"
                    >
                      <LockOpen size={14} />
                    </button>
                  )}
                  {u.id !== user.id && (
                    <button
                      onClick={() => { if (confirm(`${u.username} を削除しますか？この操作は元に戻せません。`)) deleteUserMutation.mutate(u.id); }}
                      disabled={deleteUserMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {u.id !== user.id && (
                    <button
                      onClick={() => {
                        setResetPwUserId(resetPwUserId === u.id ? null : u.id);
                        setResetPwValue('');
                        setEditUserId(null);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="パスワードをリセット"
                    >
                      <KeyRound size={14} />
                    </button>
                  )}
                  <select
                    value={u.role}
                    disabled={u.id === user.id || updateRoleMutation.isPending}
                    onChange={(e) => updateRoleMutation.mutate({ id: u.id, role: e.target.value })}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-200"
                  >
                    <option value="viewer">閲覧者</option>
                    <option value="editor">編集者</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
              </div>
              {editUserId === u.id && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="ユーザー名"
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="メールアドレス（任意）"
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateProfileMutation.mutate({ id: u.id, username: editUsername, email: editEmail })}
                      disabled={!editUsername || updateProfileMutation.isPending}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                    >
                      {updateProfileMutation.isPending ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => { setEditUserId(null); setEditUsername(''); setEditEmail(''); setEditError(''); }}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
              {resetPwUserId === u.id && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={resetPwValue}
                      onChange={(e) => { setResetPwValue(e.target.value); setResetPwError(''); }}
                      placeholder="新しいパスワード（8文字以上）"
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={() => resetPasswordMutation.mutate({ id: u.id, password: resetPwValue })}
                      disabled={resetPwValue.length < 8 || resetPasswordMutation.isPending}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                    >
                      {resetPasswordMutation.isPending ? 'リセット中...' : 'リセット'}
                    </button>
                    <button
                      onClick={() => { setResetPwUserId(null); setResetPwValue(''); setResetPwError(''); }}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
                    >
                      キャンセル
                    </button>
                  </div>
                  {resetPwError && (
                    <p className="text-xs text-red-500">{resetPwError}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
