import { api } from "@/lib/api.ts";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/register", { username, password });
      void navigate("/login");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">アカウント作成</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label htmlFor="register-username" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            ユーザー名
          </label>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            パスワード
          </label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            8文字以上で入力してください
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "作成中..." : "アカウントを作成"}
        </button>
      </form>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
        すでにアカウントをお持ちの方は{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
