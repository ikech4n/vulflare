interface EolStatusBadgeProps {
  eolDate: string | null;
  isEol: boolean;
}

export function EolStatusBadge({ eolDate, isEol }: EolStatusBadgeProps) {
  if (!eolDate) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 whitespace-nowrap">
        未定
      </span>
    );
  }

  if (isEol) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 whitespace-nowrap">
        EOL済み
      </span>
    );
  }

  const now = new Date();
  // SQLite の date('now') と合わせるため UTC 基準の今日の午前0時で比較する
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const eolUtcMs = new Date(eolDate).getTime(); // YYYY-MM-DD は UTC midnight として解析される
  const daysUntilEol = Math.round((eolUtcMs - todayUtcMs) / (1000 * 60 * 60 * 24));

  if (daysUntilEol <= 30) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 whitespace-nowrap">
        30日以内
      </span>
    );
  }

  if (daysUntilEol <= 90) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 whitespace-nowrap">
        90日以内
      </span>
    );
  }

  return (
    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 whitespace-nowrap">
      サポート中
    </span>
  );
}
