import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";
import { type Theme, useThemeStore } from "@/store/themeStore.ts";
import { useMutation } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "ライト" },
  { value: "dark", icon: Moon, label: "ダーク" },
  { value: "system", icon: Monitor, label: "システム" },
];

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  const updateDisplayNameMutation = useMutation({
    mutationFn: (body: { displayName: string | null }) => api.patch("/auth/me", body),
    onSuccess: () => {
      setDisplayNameSuccess(true);
      if (user) {
        setUser({ ...user, displayName: displayName.trim() || null });
      }
    },
  });

  const handleDisplayNameSave = (e: FormEvent) => {
    e.preventDefault();
    setDisplayNameSuccess(false);
    updateDisplayNameMutation.mutate({ displayName: displayName.trim() || null });
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const changePwMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.post("/auth/change-password", body),
    onSuccess: () => {
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => {
      setPwError("パスワードの変更に失敗しました。現在のパスワードを確認してください。");
    },
  });

  const handlePasswordChange = (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (newPassword !== confirmPassword) {
      setPwError("パスワードが一致しません");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("パスワードは8文字以上で入力してください");
      return;
    }
    changePwMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">プロフィール</h1>

      {/* Profile info */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          アカウント情報
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">ログインID</span>
            <span className="text-gray-900 dark:text-gray-100">{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">表示名</span>
            <span className="text-gray-900 dark:text-gray-100">
              {user?.displayName || (
                <span className="text-gray-400 dark:text-gray-500">未設定</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">ロール</span>
            <span className="text-gray-900 dark:text-gray-100">
              {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">表示名</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          担当者欄や変更履歴で表示される名前です。未設定の場合はログインIDが使われます。
        </p>
        <form onSubmit={handleDisplayNameSave} className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setDisplayNameSuccess(false);
            }}
            maxLength={100}
            placeholder={user?.username}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            disabled={updateDisplayNameMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {updateDisplayNameMutation.isPending ? "保存中..." : "保存"}
          </button>
        </form>
        {displayNameSuccess && <p className="text-sm text-green-600 mt-2">表示名を更新しました</p>}
        {updateDisplayNameMutation.isError && (
          <p className="text-sm text-red-600 mt-2">更新に失敗しました</p>
        )}
      </div>

      {/* Theme */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">テーマ</h2>
        <div className="flex gap-2">
          {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                theme === value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          パスワードを変更
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              現在のパスワード
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              新しいパスワード
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              新しいパスワード（確認）
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-600">パスワードを変更しました</p>}
          <button
            type="submit"
            disabled={changePwMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {changePwMutation.isPending ? "保存中..." : "パスワードを変更"}
          </button>
        </form>
      </div>
    </div>
  );
}
