import { z } from 'zod';

// パスワードポリシー: 8文字以上 + 大文字/小文字/数字/特殊文字
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// CVE ID フォーマット: CVE-YYYY-XXXXX
const cveIdSchema = z
  .string()
  .regex(/^CVE-\d{4}-\d{4,}$/, 'CVE ID must match format CVE-YYYY-XXXXX');

// CVSS スコア: 0-10
const cvssScoreSchema = z
  .number()
  .min(0, 'CVSS score must be between 0 and 10')
  .max(10, 'CVSS score must be between 0 and 10');

// 共通エンタム
const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'informational']);
const statusSchema = z.enum(['active', 'fixed', 'accepted_risk', 'false_positive']);
const roleSchema = z.enum(['admin', 'editor', 'viewer']);
const environmentSchema = z.enum(['production', 'staging', 'development', 'qa']);

// ========================================
// 認証スキーマ
// ========================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(1, 'Username is required').max(100, 'Username too long'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ========================================
// 脆弱性スキーマ
// ========================================

export const createVulnerabilitySchema = z.object({
  cveId: cveIdSchema.optional(),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(10000, 'Description too long').optional(),
  severity: severitySchema.optional(),
  cvssV3Score: cvssScoreSchema.optional(),
  cvssV3Vector: z.string().max(100, 'CVSS vector too long').optional(),
  cweIds: z.array(z.string()).optional(),
  references: z.array(z.unknown()).optional(),
  publishedAt: z.string().datetime().optional(),
});

export const updateVulnerabilitySchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(10000, 'Description too long').optional(),
  severity: severitySchema.optional(),
  status: statusSchema.optional(),
  cvssV3Score: cvssScoreSchema.optional(),
  cvssV3Vector: z.string().max(100, 'CVSS vector too long').optional(),
});

// ========================================
// アセットスキーマ
// ========================================

export const createAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  assetType: z.string().min(1, 'Asset type is required').max(50, 'Asset type too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  environment: environmentSchema.optional(),
  owner: z.string().max(200, 'Owner too long').optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long').optional(),
  assetType: z.string().min(1, 'Asset type is required').max(50, 'Asset type too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  environment: environmentSchema.optional(),
  owner: z.string().max(200, 'Owner too long').optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const linkVulnerabilitySchema = z.object({
  vulnerabilityId: z.string().uuid('Invalid vulnerability ID'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

export const updateAssetVulnerabilitySchema = z.object({
  status: statusSchema.optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assignedTo: z.string().max(200, 'Assigned to too long').optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().max(5000, 'Notes too long').optional(),
});

// ========================================
// ユーザースキーマ
// ========================================

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(1, 'Username is required').max(100, 'Username too long'),
  password: passwordSchema,
  role: roleSchema.optional(),
});

export const updateUserSchema = z.object({
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

// ========================================
// 同期設定スキーマ
// ========================================

// ベンダー/製品選択の構造
const jvnProductSelectionSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  cpe: z.string().min(1, 'CPE is required'),
});

const jvnVendorSelectionSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  vendorName: z.string().min(1, 'Vendor name is required'),
  products: z.array(jvnProductSelectionSchema).default([]),
});

export const updateSyncSettingsSchema = z.object({
  vendorSelections: z
    .array(jvnVendorSelectionSchema)
    .max(100, 'Maximum 100 vendor selections allowed'),
  keywords: z
    .array(z.string().min(1, 'Keyword cannot be empty'))
    .max(50, 'Maximum 50 keywords allowed'),
  excludeKeywords: z
    .array(z.string().min(1, 'Exclude keyword cannot be empty'))
    .max(50, 'Maximum 50 exclude keywords allowed'),
  cvssMinScore: z
    .number()
    .min(0, 'CVSS min score must be between 0 and 10')
    .max(10, 'CVSS min score must be between 0 and 10')
    .default(0),
  fullSyncDays: z
    .number()
    .int('Full sync days must be an integer')
    .min(0, 'Full sync days must be non-negative'),
  retentionDays: z
    .number()
    .int('Retention days must be non-negative')
    .min(0, 'Retention days must be non-negative'),
  dataSources: z.object({
    jvn: z.boolean(),
  }),
});

export const cancelSyncSchema = z.object({
  source: z.enum(['jvn']),
});

export const deleteSyncDataSchema = z.object({
  source: z.enum(['jvn']),
});

// ========================================
// パッケージスキーマ
// ========================================

const ecosystemSchema = z.enum([
  'npm', 'pypi', 'maven', 'go', 'nuget', 'rubygems', 'crates.io', 'packagist', 'cpe',
]);

export const createAssetPackageSchema = z.object({
  ecosystem: ecosystemSchema,
  name: z.string().min(1, 'Name is required').max(500, 'Name too long'),
  version: z.string().min(1, 'Version is required').max(200, 'Version too long'),
  vendor: z.string().max(200, 'Vendor too long').optional(),
});

export const importAssetPackagesSchema = z.object({
  packages: z
    .array(
      z.object({
        ecosystem: ecosystemSchema,
        name: z.string().min(1).max(500),
        version: z.string().min(1).max(200),
        vendor: z.string().max(200).optional(),
      }),
    )
    .min(1, 'At least one package is required')
    .max(1000, 'Maximum 1000 packages per import'),
});

// ========================================
// 一括更新スキーマ
// ========================================

export const batchUpdateVulnerabilitiesSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid vulnerability ID'))
    .min(1, 'At least one vulnerability ID is required')
    .max(100, 'Maximum 100 vulnerabilities per batch update'),
  updates: z.object({
    severity: severitySchema.optional(),
    status: statusSchema.optional(),
  }).refine(
    (data) => data.severity !== undefined || data.status !== undefined,
    { message: 'At least one field must be specified for update' }
  ),
});
