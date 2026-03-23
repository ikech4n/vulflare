import type { CsvImportResult } from "@vulflare/shared/types";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api.ts";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function CsvImportModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const res = await api.post<CsvImportResult>(
        `/reports/vulnerabilities/csv/import?mode=${mode}`,
        text,
        { headers: { "Content-Type": "text/csv" } },
      );
      setResult(res.data);
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "インポートに失敗しました";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CSVインポート</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {!result ? (
          <>
            <div>
              <label
                htmlFor="csv-file-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                CSVファイル
              </label>
              <input
                id="csv-file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  dark:file:bg-blue-900/30 dark:file:text-blue-300
                  hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                エクスポート形式のCSVに対応（最大1000行）
              </p>
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                重複時の動作
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    value="skip"
                    checked={mode === "skip"}
                    onChange={() => setMode("skip")}
                    className="text-blue-600"
                  />
                  スキップ（既存データを保持）
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    value="update"
                    checked={mode === "update"}
                    onChange={() => setMode("update")}
                    className="text-blue-600"
                  />
                  上書き更新
                </label>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? "インポート中..." : "インポート"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                キャンセル
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">
                インポート完了
              </h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {result.imported}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">新規登録</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {result.updated}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">更新</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">
                    {result.skipped}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">スキップ</div>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                  エラー ({result.errors.length}件)
                </h3>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e) => (
                    <li key={e.row} className="text-xs text-red-700 dark:text-red-400">
                      行 {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              閉じる
            </button>
          </>
        )}
      </div>
    </div>
  );
}
