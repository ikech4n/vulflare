# Vulflare - Vulnerability Management Platform

[![CI](https://github.com/ikech4n/vulflare/actions/workflows/ci.yml/badge.svg)](https://github.com/ikech4n/vulflare/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Cloudflare 技術スタックのみで構築した、OSS の脆弱性管理プラットフォームです。

## 主な機能

- **脆弱性ダッシュボード** — CVE の一覧・フィルタリング・ステータス管理
- **自動データ同期** — NVD / JVN / EUVD から毎日 01:00 UTC に自動取得
- **スキャナ連携** — Trivy / Grype の JSON レポートをインポート
- **EOL 追跡** — プロダクト・バージョンの End of Life を監視
- **ロールベースアクセス制御** — 管理者 / 一般ユーザーの権限管理
- **通知システム** — 脆弱性アラート・EOL アラート

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | React 19 + Vite + TypeScript + TailwindCSS |
| Backend API | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| Cache/Sessions | Cloudflare KV |
| File Storage | Cloudflare R2 |
| Background Jobs | Cloudflare Queues |
| NVD Sync | Cloudflare Scheduled Workers |

## セットアップ

### 前提条件

- Node.js 20 以上
- pnpm 9 以上
- Cloudflare アカウント

### 1. 依存関係インストール

```bash
pnpm install
```

### 2. Cloudflare リソース作成

```bash
# D1 データベース
npx wrangler d1 create vulflare-db

# KV Namespaces
npx wrangler kv namespace create KV_SESSIONS
npx wrangler kv namespace create KV_CACHE

# R2 バケット
npx wrangler r2 bucket create vulflare-scanner-results

# Queues
npx wrangler queues create vulflare-import-queue
npx wrangler queues create vulflare-import-dlq
```

取得した ID を `wrangler.toml` の各プレースホルダー（`YOUR_D1_DATABASE_ID` など）に設定してください。

### 3. 環境変数設定

```bash
cp .dev.vars.example .dev.vars
# .dev.vars を編集して JWT_SECRET を設定
```

### 4. DB マイグレーション

```bash
pnpm db:migrate
```

### 5. 開発サーバー起動

```bash
# Worker（ポート 8787）
pnpm dev:worker

# Web（ポート 5173）— 別ターミナルで
pnpm dev:web
```

## スキャナ連携

### Trivy

```bash
trivy image --format json -o result.json myimage:tag
```

### Grype

```bash
grype myimage:tag -o json --file result.json
```

Import ページから生成された JSON ファイルをアップロードしてください。

## NVD API

- 毎日 01:00 UTC（10:00 JST）に自動同期
- 管理者は NVD Sync ページから手動トリガー可能
- NVD API Key を設定するとレート制限が緩和される（6秒 → 0.6秒/リクエスト）

## デプロイ

```bash
# Worker デプロイ
pnpm deploy:worker

# Web（Cloudflare Pages）デプロイ
pnpm deploy:web
```

詳細なデプロイ手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## コントリビュート

コントリビューションを歓迎します！詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## セキュリティ

セキュリティ脆弱性を発見した場合は、[SECURITY.md](SECURITY.md) の手順に従って報告してください。

## ライセンス

[Apache License 2.0](LICENSE)
