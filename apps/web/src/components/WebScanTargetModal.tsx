import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateWebScanTargetRequest, WebScanTarget } from "@vulflare/shared/types";
import { Globe, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api.ts";

interface WebScanTargetModalProps {
  onClose: () => void;
}

export function WebScanTargetModal({ onClose }: WebScanTargetModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: CreateWebScanTargetRequest) => {
      const res = await api.post<WebScanTarget>("/web-scanner/targets", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-scanner-targets"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "エラーが発生しました";
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    if (!url.trim()) {
      setError("URLを入力してください");
      return;
    }
    try {
      new URL(url);
    } catch {
      setError("有効なURLを入力してください (例: https://example.com)");
      return;
    }

    createMutation.mutate({ name: name.trim(), url: url.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe size={18} />
            新規スキャンターゲット
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="target-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              名前
            </label>
            <input
              id="target-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="本番サイト"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="target-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              URL
            </label>
            <input
              id="target-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              スキャン対象のWebサイトのURLを入力してください
            </p>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {createMutation.isPending ? "追加中..." : "追加してスキャン開始"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
