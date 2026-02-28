const STYLES: Record<string, string> = {
  new: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  open: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  fixed: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  accepted_risk: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  false_positive: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

const LABELS: Record<string, string> = {
  new: '新規',
  open: '対応中',
  fixed: '解決済み',
  accepted_risk: 'リスク受容',
  false_positive: '誤検知',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[status] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
