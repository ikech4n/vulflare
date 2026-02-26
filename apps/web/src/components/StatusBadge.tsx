const STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  fixed: 'bg-green-100 text-green-800',
  accepted_risk: 'bg-purple-100 text-purple-800',
  false_positive: 'bg-gray-100 text-gray-700',
};

const LABELS: Record<string, string> = {
  active: '対応中',
  open: '未対応',
  in_progress: '対応中',
  fixed: '解決済み',
  accepted_risk: 'リスク受容',
  false_positive: '誤検知',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
