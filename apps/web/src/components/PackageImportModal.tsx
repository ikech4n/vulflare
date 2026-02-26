import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { EcosystemBadge } from './EcosystemBadge.tsx';

interface PackageEntry {
  ecosystem: string;
  name: string;
  version: string;
  vendor?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (packages: PackageEntry[]) => void;
  isPending: boolean;
}

export function PackageImportModal({ open, onClose, onImport, isPending }: Props) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<PackageEntry[]>([]);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleParse = (text: string) => {
    setRawText(text);
    setParseError('');
    setParsed([]);

    if (!text.trim()) return;

    try {
      const data = JSON.parse(text);
      const packages: PackageEntry[] = Array.isArray(data)
        ? data
        : data.packages
          ? data.packages
          : [data];

      // バリデーション
      for (let i = 0; i < packages.length; i++) {
        const p = packages[i]!;
        if (!p.ecosystem || !p.name || !p.version) {
          setParseError(`パッケージ ${i + 1}: ecosystem, name, version は必須です`);
          return;
        }
      }

      if (packages.length > 1000) {
        setParseError('一度にインポートできるのは最大1000件です');
        return;
      }

      setParsed(packages);
    } catch {
      setParseError('JSONの解析に失敗しました。有効なJSON形式で入力してください。');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleParse(text);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (parsed.length > 0) {
      onImport(parsed);
    }
  };

  const handleClose = () => {
    setRawText('');
    setParsed([]);
    setParseError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">パッケージインポート</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              JSON形式でパッケージ情報を入力するか、JSONファイルをアップロードしてください。
            </p>
            <p className="text-xs text-gray-500 mb-3">
              形式: <code className="bg-gray-100 px-1 py-0.5 rounded">
                {'[{"ecosystem":"npm","name":"express","version":"4.18.2"}, ...]'}
              </code>
            </p>
          </div>

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              <Upload size={14} />
              JSONファイルを選択
            </button>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => handleParse(e.target.value)}
            placeholder={'[\n  { "ecosystem": "npm", "name": "express", "version": "4.18.2" },\n  { "ecosystem": "pypi", "name": "django", "version": "4.2.0" },\n  { "ecosystem": "cpe", "name": "mysql", "version": "8.0.33", "vendor": "oracle" }\n]'}
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {parseError && (
            <p className="text-sm text-red-600">{parseError}</p>
          )}

          {parsed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                プレビュー ({parsed.length}件)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">エコシステム</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">名前</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">バージョン</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ベンダー</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsed.slice(0, 20).map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5"><EcosystemBadge ecosystem={p.ecosystem} /></td>
                        <td className="px-3 py-1.5 text-gray-900">{p.name}</td>
                        <td className="px-3 py-1.5 text-gray-700">{p.version}</td>
                        <td className="px-3 py-1.5 text-gray-500">{p.vendor ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 20 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                    ...他 {parsed.length - 20} 件
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsed.length === 0 || isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'インポート中...' : `${parsed.length}件をインポート`}
          </button>
        </div>
      </div>
    </div>
  );
}
