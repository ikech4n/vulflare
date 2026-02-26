export type PackageEcosystem =
  | 'npm'
  | 'pypi'
  | 'maven'
  | 'go'
  | 'nuget'
  | 'rubygems'
  | 'crates.io'
  | 'packagist'
  | 'cpe';

export interface AssetPackage {
  id: string;
  assetId: string;
  ecosystem: PackageEcosystem;
  name: string;
  version: string;
  vendor: string | null;
  cpeString: string | null;
  purl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VulnerabilityPackage {
  id: string;
  vulnerabilityId: string;
  assetPackageId: string;
  matchType: 'exact' | 'range' | 'cpe';
  matchSource: 'osv' | 'nvd' | 'jvn';
  matchedAt: string;
}

export interface CreateAssetPackageRequest {
  ecosystem: PackageEcosystem;
  name: string;
  version: string;
  vendor?: string;
}

export interface ImportPackagesRequest {
  packages: CreateAssetPackageRequest[];
}
