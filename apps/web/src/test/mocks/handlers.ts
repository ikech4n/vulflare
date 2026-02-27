import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8787/api';

export const handlers = [
  // 認証
  http.post(`${API_BASE}/auth/login`, () => {
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      user: {
        id: '1',
        username: 'testuser',
        role: 'admin',
      },
    });
  }),

  // 脆弱性統計
  http.get(`${API_BASE}/vulnerabilities/stats`, () => {
    return HttpResponse.json({
      total: 42,
      bySeverity: {
        critical: 5,
        high: 10,
        medium: 15,
        low: 10,
        informational: 2,
      },
      byStatus: {
        active: 30,
        fixed: 10,
        accepted_risk: 1,
        false_positive: 1,
      },
      recentlyAdded: 3,
    });
  }),

  // 脆弱性一覧
  http.get(`${API_BASE}/vulnerabilities`, () => {
    return HttpResponse.json({
      data: [
        {
          id: '1',
          cveId: 'CVE-2024-12345',
          title: 'Test Vulnerability',
          severity: 'high',
          status: 'new',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  }),
];
