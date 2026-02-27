import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createVulnerabilitySchema,
  updateSyncSettingsSchema,
} from './schemas';

describe('Authentication Schemas', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const valid = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestPass123!',
      };
      expect(() => registerSchema.parse(valid)).not.toThrow();
    });

    it('should reject weak passwords', () => {
      const weak = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'weak',
      };
      expect(() => registerSchema.parse(weak)).toThrow();
    });

    it('should reject password without uppercase', () => {
      const noUpper = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'testpass123!',
      };
      expect(() => registerSchema.parse(noUpper)).toThrow(/uppercase/);
    });

    it('should reject password without special character', () => {
      const noSpecial = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestPass123',
      };
      expect(() => registerSchema.parse(noSpecial)).toThrow(/special character/);
    });

    it('should reject invalid email', () => {
      const invalid = {
        email: 'not-an-email',
        username: 'testuser',
        password: 'TestPass123!',
      };
      expect(() => registerSchema.parse(invalid)).toThrow(/email/);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const valid = {
        email: 'test@example.com',
        password: 'anypassword',
      };
      expect(() => loginSchema.parse(valid)).not.toThrow();
    });

    it('should reject missing email', () => {
      const invalid = { password: 'test' };
      expect(() => loginSchema.parse(invalid)).toThrow();
    });
  });
});

describe('Vulnerability Schemas', () => {
  describe('createVulnerabilitySchema', () => {
    it('should accept valid CVE ID', () => {
      const valid = {
        cveId: 'CVE-2024-12345',
        title: 'Test Vulnerability',
      };
      expect(() => createVulnerabilitySchema.parse(valid)).not.toThrow();
    });

    it('should reject invalid CVE ID format', () => {
      const invalid = {
        cveId: 'INVALID-2024-12345',
        title: 'Test Vulnerability',
      };
      expect(() => createVulnerabilitySchema.parse(invalid)).toThrow(/CVE ID/);
    });

    it('should reject CVSS score out of range', () => {
      const invalid = {
        title: 'Test Vulnerability',
        cvssV3Score: 15,
      };
      expect(() => createVulnerabilitySchema.parse(invalid)).toThrow(/CVSS score/);
    });

    it('should accept valid CVSS score', () => {
      const valid = {
        title: 'Test Vulnerability',
        cvssV3Score: 7.5,
      };
      expect(() => createVulnerabilitySchema.parse(valid)).not.toThrow();
    });
  });
});


describe('Sync Settings Schema', () => {
  describe('updateSyncSettingsSchema', () => {
    const baseValid = {
      vendorSelections: [],
      keywords: ['apache', 'nginx'],
      excludeKeywords: [],
      fullSyncDays: 30,
      retentionDays: 90,
      dataSources: { jvn: true },
    };

    it('should accept valid sync settings', () => {
      expect(() => updateSyncSettingsSchema.parse(baseValid)).not.toThrow();
    });

    it('should reject negative fullSyncDays', () => {
      const invalid = { ...baseValid, fullSyncDays: -1 };
      expect(() => updateSyncSettingsSchema.parse(invalid)).toThrow();
    });

    it('should reject empty keyword', () => {
      const invalid = { ...baseValid, keywords: ['apache', ''] };
      expect(() => updateSyncSettingsSchema.parse(invalid)).toThrow();
    });
  });
});
