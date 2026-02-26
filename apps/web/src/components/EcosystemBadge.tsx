import type { PackageEcosystem } from '@vulflare/shared/types';

const STYLES: Record<PackageEcosystem, string> = {
  npm: 'bg-red-50 text-red-700 border border-red-200',
  pypi: 'bg-blue-50 text-blue-700 border border-blue-200',
  maven: 'bg-orange-50 text-orange-700 border border-orange-200',
  go: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  nuget: 'bg-purple-50 text-purple-700 border border-purple-200',
  rubygems: 'bg-rose-50 text-rose-700 border border-rose-200',
  'crates.io': 'bg-amber-50 text-amber-700 border border-amber-200',
  packagist: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  cpe: 'bg-gray-50 text-gray-700 border border-gray-200',
};

const LABELS: Record<PackageEcosystem, string> = {
  npm: 'npm',
  pypi: 'PyPI',
  maven: 'Maven',
  go: 'Go',
  nuget: 'NuGet',
  rubygems: 'RubyGems',
  'crates.io': 'Crates',
  packagist: 'Packagist',
  cpe: 'CPE',
};

export function EcosystemBadge({ ecosystem }: { ecosystem: string }) {
  const key = ecosystem as PackageEcosystem;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[key] ?? STYLES.cpe}`}>
      {LABELS[key] ?? ecosystem}
    </span>
  );
}
