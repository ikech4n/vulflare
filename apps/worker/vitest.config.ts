import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: '../../wrangler.toml' },
        miniflare: {
          // テスト用のシークレット（wrangler.tomlに定義されていないため個別に設定）
          bindings: { JWT_SECRET: 'test-jwt-secret-for-unit-tests' },
        },
      },
    },
  },
});
