import { api } from "@/lib/api.ts";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch {
      // セキュリティ上、エラーでも同じメッセージを表示する
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        パスワードをリセット
      </h2>
      {submitted ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。メールをご確認ください。
          </p>
          <p className="text-sm text-center">
            <Link to="/login" className="text-blue-600 hover:underline dark:text-blue-400">
              ログインページに戻る
            </Link>
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクを送信します。
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                メールアドレス
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="example@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "送信中..." : "リセットリンクを送信"}
            </button>
            <p className="text-sm text-center">
              <Link to="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                ログインページに戻る
              </Link>
            </p>
          </form>
        </>
      )}
    </div>
  );
}
