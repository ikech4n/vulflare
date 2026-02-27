import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.ts';
import { useAuthStore } from '@/store/authStore.ts';
import type { LoginResponse } from '@vulflare/shared/types';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(true);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    api.get<{ initialized: boolean }>('/auth/initialized')
      .then(({ data }) => setInitialized(data.initialized))
      .catch(() => setInitialized(true));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      login(data.accessToken, data.user);
      void navigate('/');
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">ログイン</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
      {!initialized && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
          アカウントをお持ちでない方は{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            新規登録
          </Link>
        </p>
      )}
    </div>
  );
}
