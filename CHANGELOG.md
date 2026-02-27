# Changelog

このプロジェクトのすべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠しています。

## [Unreleased]

### Added

- 脆弱性管理ダッシュボード（CVE 一覧・フィルタリング・ステータス管理）
- JVN（Japan Vulnerability Notes）の自動日次同期（毎日 01:00 UTC）
- プロダクト・バージョンの EOL（End of Life）追跡
- ロールベースアクセス制御（管理者 / 一般ユーザー）
- 通知システム（脆弱性アラート・EOL アラート）
- Cloudflare Workers + Hono による REST API
- React 19 + Vite + TailwindCSS によるフロントエンド
- Cloudflare D1（SQLite）によるデータベース
- Cloudflare KV によるセッション管理・キャッシュ
- Cloudflare Queues によるバックグラウンドジョブ処理
