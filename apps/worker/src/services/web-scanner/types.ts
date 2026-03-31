import type { Env } from "../../types.ts";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "informational";

export interface CheckFinding {
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: string | null;
  remediation: string | null;
}

export interface CheckResult {
  checkId: string;
  findings: CheckFinding[];
}

export interface CheckContext {
  targetUrl: string;
  baseResponse: Response;
  baseHtml: string;
  env: Env;
}

export type CheckFn = (ctx: CheckContext) => Promise<CheckResult>;
