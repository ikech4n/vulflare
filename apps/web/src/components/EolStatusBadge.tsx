interface EolStatusBadgeProps {
  eolDate: string | null;
  isEol: boolean;
}

export function EolStatusBadge({ eolDate, isEol }: EolStatusBadgeProps) {
  if (!eolDate) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
        未定
      </span>
    );
  }

  if (isEol) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
        EOL済み
      </span>
    );
  }

  const now = new Date();
  const eol = new Date(eolDate);
  const daysUntilEol = Math.floor((eol.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilEol <= 30) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800">
        30日以内
      </span>
    );
  }

  if (daysUntilEol <= 90) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
        90日以内
      </span>
    );
  }

  return (
    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
      サポート中
    </span>
  );
}
