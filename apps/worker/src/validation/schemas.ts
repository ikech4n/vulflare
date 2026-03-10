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
const statusSchema = z.enum(['new', 'open', 'fixed', 'accepted_risk', 'false_positive']);
const roleSchema = z.enum(['admin', 'editor', 'viewer']);

// ========================================
// 認証スキーマ
// ========================================

export const registerSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100, 'Username too long'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const updateAppSettingsSchema = z.object({
  noreplyEmail: z.string().email('Invalid email address'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordWithTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
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
  cvssV4Score: cvssScoreSchema.optional(),
  cvssV4Vector: z.string().max(200, 'CVSS v4 vector too long').optional(),
  cweIds: z.array(z.string()).optional(),
  references: z.array(z.unknown()).optional(),
  publishedAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),
});

export const updateVulnerabilitySchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(10000, 'Description too long').optional(),
  severity: severitySchema.optional(),
  status: statusSchema.optional(),
  cvssV3Score: cvssScoreSchema.optional(),
  cvssV3Vector: z.string().max(100, 'CVSS vector too long').optional(),
  cvssV4Score: cvssScoreSchema.optional(),
  cvssV4Vector: z.string().max(200, 'CVSS v4 vector too long').optional(),
  cweIds: z.array(z.string()).optional(),
  references: z.array(z.unknown()).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  modifiedAt: z.string().datetime().nullable().optional(),
  memo: z.string().max(2000, 'Memo too long').nullable().optional(),
});


// ========================================
// ユーザースキーマ
// ========================================

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100, 'Username too long'),
  password: passwordSchema,
  role: roleSchema.optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const updateUserSchema = z.object({
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  username: z.string().min(1, 'Username is required').max(100, 'Username too long').optional(),
  email: z.string().email('Invalid email address').nullable().optional(),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateMeSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
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
// メモスキーマ
// ========================================

export const createMemoSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
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
