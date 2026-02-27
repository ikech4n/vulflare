import type { Severity } from '@vulflare/shared/types';

const STYLES: Record<Severity, string> = {
  critical: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
  low: 'bg-lime-100 dark:bg-lime-900 text-lime-800 dark:text-lime-200 border border-lime-200 dark:border-lime-800',
  informational: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
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
