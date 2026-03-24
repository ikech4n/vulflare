import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "../../wrangler.toml" },
      miniflare: {
        // テスト用のシークレット（wrangler.tomlに定義されていないため個別に設定）
        bindings: { JWT_SECRET: "test-jwt-secret-for-unit-tests" },
      },
    }),
  ],
});
