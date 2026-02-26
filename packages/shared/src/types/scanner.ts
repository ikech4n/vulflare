// Trivy JSON output types (trivy image/fs --format json)
export interface TrivyReport {
  SchemaVersion: number;
  ArtifactName: string;
  ArtifactType: 'container_image' | 'filesystem' | 'repository';
  Metadata?: {
    ImageID?: string;
    RepoTags?: string[];
    RepoDigests?: string[];
    OS?: { Family: string; Name: string };
  };
  Results: TrivyResult[];
}

export interface TrivyResult {
  Target: string;
  Class: 'os-pkgs' | 'lang-pkgs' | 'secret' | 'config';
  Type: string;
  Vulnerabilities?: TrivyVulnerability[];
}

export interface TrivyVulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  SeveritySource?: string;
  Severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  Title?: string;
  Description?: string;
  CVSS?: {
    nvd?: {
      V3Score?: number;
      V3Vector?: string;
      V2Score?: number;
      V2Vector?: string;
    };
    redhat?: { V3Score?: number; V3Vector?: string };
  };
  References?: string[];
  PublishedDate?: string;
  LastModifiedDate?: string;
  CweIDs?: string[];
}

// Grype JSON output types (grype --output json)
export interface GrypeReport {
  matches: GrypeMatch[];
  source: {
    type: 'image' | 'directory' | 'file';
    target: { userInput: string; imageID?: string; tags?: string[] };
  };
  distro?: { name: string; version: string };
  descriptor: { name: 'grype'; version: string };
}

export interface GrypeMatch {
  vulnerability: {
    id: string;
    dataSource: string;
    namespace: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Negligible' | 'Unknown';
    urls: string[];
    description?: string;
    cvss?: Array<{
      version: string;
      vector: string;
      metrics: { baseScore: number };
    }>;
    fix: {
      versions: string[];
      state: 'fixed' | 'not-fixed' | 'unknown' | 'wont-fix';
    };
  };
  relatedVulnerabilities: Array<{ id: string; severity: string }>;
  matchDetails: Array<{
    type: string;
    matcher: string;
    searchedBy: Record<string, unknown>;
    found: Record<string, unknown>;
  }>;
  artifact: {
    name: string;
    version: string;
    type: string;
    purl?: string;
  };
}

export type ScannerType = 'trivy' | 'grype';

export interface ScanImport {
  id: string;
  assetId: string | null;
  scannerType: ScannerType;
  fileName: string;
  r2ObjectKey: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalVulns: number;
  createdVulns: number;
  updatedVulns: number;
  errorMessage: string | null;
  importedBy: string;
  createdAt: string;
  completedAt: string | null;
}
