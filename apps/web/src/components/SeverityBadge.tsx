import type { Severity } from '@vulflare/shared/types';

const STYLES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border border-red-200',
  high: 'bg-orange-100 text-orange-800 border border-orange-200',
  medium: 'bg-amber-100 text-amber-800 border border-amber-200',
  low: 'bg-lime-100 text-lime-800 border border-lime-200',
  informational: 'bg-gray-100 text-gray-700 border border-gray-200',
};

const LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  informational: 'Info',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const key = severity as Severity;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[key] ?? STYLES.informational}`}>
      {LABELS[key] ?? severity}
    </span>
  );
}
