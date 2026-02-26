export type AssetType = 'server' | 'container' | 'application' | 'library' | 'network_device';
export type Environment = 'production' | 'staging' | 'development';

export interface Asset {
  id: string;
  name: string;
  assetType: AssetType;
  description: string | null;
  environment: Environment;
  owner: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetRequest {
  name: string;
  assetType: AssetType;
  description?: string;
  environment?: Environment;
  owner?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateAssetRequest {
  name?: string;
  assetType?: AssetType;
  description?: string;
  environment?: Environment;
  owner?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AssetTemplate {
  id: string;
  name: string;
  description: string | null;
  assetType: AssetType;
  environment: Environment;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetTemplatePackage {
  id: string;
  templateId: string;
  ecosystem: string;
  name: string;
  version: string;
  vendor: string | null;
  createdAt: string;
}

export interface AssetTemplateEolLink {
  id: string;
  templateId: string;
  eolCycleId: string;
  createdAt: string;
}

export interface CreateAssetTemplateRequest {
  name: string;
  description?: string;
  assetType: AssetType;
  environment?: Environment;
  packages?: Array<{
    ecosystem: string;
    name: string;
    version: string;
    vendor?: string;
  }>;
  eolCycleIds?: string[];
}

export interface CreateAssetFromTemplateRequest {
  templateId: string;
  name: string;
  owner?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
