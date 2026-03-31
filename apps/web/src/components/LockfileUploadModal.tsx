import type { AuditLockfileType } from "@vulflare/shared/types";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api.ts";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const LOCKFILE_TYPES: { value: AuditLockfileType; label: string }[] = [
  { value: "package-lock.json", label: "package-lock.json (npm)" },
  { value: "pnpm-lock.yaml", label: "pnpm-lock.yaml (pnpm)" },
  { value: "yarn.lock", label: "yarn.lock (yarn v1)" },
  { value: "composer.lock", label: "composer.lock (PHP)" },
];

function detectType(filename: string): AuditLockfileType | null {
  const base = filename.split("/").pop() ?? filename;
  if (base === "package-lock.json") return "package-lock.json";
  if (base === "pnpm-lock.yaml") return "pnpm-lock.yaml";
  if (base === "yarn.lock") return "yarn.lock";
  if (base === "composer.lock") return "composer.lock";
  return null;
}

export function LockfileUploadModal({ onClose, onSuccess }: Props) {
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lockfileType, setLockfileType] = useState<AuditLockfileType>("package-lock.json");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (f) {
      const detected = detectType(f.name);
      if (detected) setLockfileType(detected);
    }
  };

  const handleUpload = async () => {
    if (!file || !projectName.trim()) return;
    setIsUploading(true);
    setError(null);

    try {
      const lockfileContent = await file.text();
      await api.post("/audit/projects", {
        name: projectName.trim(),
        lockfileContent,
        lockfileType,
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            新規プロジェクト作成
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <label
            htmlFor="project-name-input"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            プロジェクト名 <span className="text-red-500">*</span>
          </label>
          <input
            id="project-name-input"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="例: my-app"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="lockfile-file-input"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            Lockfile <span className="text-red-500">*</span>
          </label>
          <input
            id="lockfile-file-input"
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml,.lock"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              dark:file:bg-blue-900/30 dark:file:text-blue-300
              hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            package-lock.json / pnpm-lock.yaml / yarn.lock / composer.lock
          </p>
        </div>

        <div>
          <label
            htmlFor="lockfile-type-select"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            Lockfileタイプ
          </label>
          <select
            id="lockfile-type-select"
            value={lockfileType}
            onChange={(e) => setLockfileType(e.target.value as AuditLockfileType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LOCKFILE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!file || !projectName.trim() || isUploading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isUploading ? "作成中..." : "作成してスキャン"}
          </button>
        </div>
      </div>
    </div>
  );
}
