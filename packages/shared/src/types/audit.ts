export type AuditEcosystem = "npm" | "Packagist";
export type AuditLockfileType =
  | "package-lock.json"
  | "pnpm-lock.yaml"
  | "yarn.lock"
  | "composer.lock";
export type AuditScanStatus = "running" | "completed" | "failed";

export interface AuditProject {
  id: string;
  name: string;
  ecosystem: AuditEcosystem;
  lockfileType: AuditLockfileType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditPackage {
  id: string;
  projectId: string;
  name: string;
  version: string;
  createdAt: string;
}

export interface AuditScan {
  id: string;
  projectId: string;
  status: AuditScanStatus;
  packagesCount: number;
  vulnsFound: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface AuditFinding {
  id: string;
  scanId: string;
  packageId: string;
  vulnerabilityId: string;
  fixedVersion: string | null;
  createdAt: string;
}

export interface AuditFindingWithDetails extends AuditFinding {
  packageName: string;
  packageVersion: string;
  cveId: string | null;
  title: string;
  severity: string;
  cvssV3Score: number | null;
}

export interface AuditProjectWithStats extends AuditProject {
  packagesCount: number;
  latestScan: AuditScan | null;
  vulnsFound: number;
}

// OSV API types
export interface OsvPackageQuery {
  name: string;
  ecosystem: string;
  version?: string;
}

export interface OsvQueryBatchRequest {
  queries: Array<{ package: OsvPackageQuery; version: string }>;
}

export interface OsvVulnerability {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  modified: string;
  published?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package: { name: string; ecosystem: string };
    ranges?: Array<{
      type: string;
      events: Array<{ introduced?: string; fixed?: string }>;
    }>;
    versions?: string[];
  }>;
  references?: Array<{ type: string; url: string }>;
}

export interface OsvQueryBatchResponse {
  results: Array<{ vulns?: OsvVulnerability[] }>;
}

export interface CreateAuditProjectRequest {
  name: string;
  lockfileContent: string;
  lockfileType: AuditLockfileType;
}
