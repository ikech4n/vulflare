export type WebScanStatus = "running" | "completed" | "failed";

export type WebScanCheckId =
  | "security-headers"
  | "sensitive-files"
  | "directory-listing"
  | "https-redirect"
  | "cookie-flags"
  | "open-redirect"
  | "path-traversal"
  | "outdated-libraries"
  | "csrf-protection"
  | "info-leakage";

export interface WebScanTarget {
  id: string;
  name: string;
  url: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebScan {
  id: string;
  targetId: string;
  status: WebScanStatus;
  checksRun: number;
  findingsCount: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface WebScanFinding {
  id: string;
  scanId: string;
  checkId: WebScanCheckId;
  severity: string;
  title: string;
  description: string;
  evidence: string | null;
  remediation: string | null;
  createdAt: string;
}

export interface WebScanTargetWithStats extends WebScanTarget {
  latestScan: WebScan | null;
  findingsCount: number;
}

export interface CreateWebScanTargetRequest {
  name: string;
  url: string;
}
