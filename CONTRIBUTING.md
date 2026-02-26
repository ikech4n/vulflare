# コントリビューションガイド

Vulflare へのコントリビューションに興味を持っていただきありがとうございます！

## 前提条件

- **Node.js** 20 以上
- **pnpm** 9 以上
- **Cloudflare アカウント**（ローカル開発のみなら不要）
- **Wrangler CLI** (`npm install -g wrangler`)

## ローカル開発環境のセットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/ikech4n/vulflare.git
cd vulflare
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

```bash
cp .dev.vars.example .dev.vars
# .dev.vars を編集して JWT_SECRET などを設定
```

`.dev.vars` の例：

```
JWT_SECRET=your-secret-key-here
```

### 4. Cloudflare リソースの作成（初回のみ）

Cloudflare アカウントを使用してリソースを作成します：

```bash
# D1 データベース
npx wrangler d1 create vulflare-db

# KV Namespaces
npx wrangler kv namespace create KV_SESSIONS
npx wrangler kv namespace create KV_CACHE
```

取得した ID を `wrangler.toml` に設定してください。

### 5. DB マイグレーション

```bash
pnpm db:migrate
```

### 6. 開発サーバーの起動

```bash
# Worker（ポート 8787）
pnpm dev:worker

# Web（ポート 5173）- 別ターミナルで
pnpm dev:web
```

## テスト

```bash
# 全テスト
pnpm test

# Worker のみ
pnpm test:worker

# Web のみ
pnpm test:web

# 型チェック
pnpm type-check
```

## ブランチ命名規則

| プレフィックス | 用途 |
|-------------|------|
| `feat/` | 新機能 |
| `fix/` | バグ修正 |
| `docs/` | ドキュメント更新 |
| `refactor/` | リファクタリング |
| `test/` | テスト追加・修正 |
| `chore/` | ビルド・CI 設定など |

例: `feat/add-github-advisory-sync`

## コミットメッセージ規則

[Conventional Commits](https://www.conventionalcommits.org/ja/) に従います：

```
<type>(<scope>): <summary>

[optional body]
[optional footer]
```

**type の例:**

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `refactor`: バグ修正・新機能でないコード変更
- `test`: テストの追加・修正
- `chore`: ビルドプロセス・補助ツールの変更

**例:**

```
feat(worker): JVN 同期の差分取得に対応

既存の全件取得から差分取得に変更し、API 呼び出し回数を削減。
lastModDate を KV に保存して次回取得時に参照する。
```

## プルリクエストのプロセス

1. `main` ブランチから作業ブランチを作成
2. 変更を加え、テストを追加
3. `pnpm type-check` と `pnpm test` が通ることを確認
4. `CHANGELOG.md` の `[Unreleased]` セクションに変更を記載
5. Pull Request を作成（テンプレートに従って記入）
6. レビューを受け、必要に応じて修正
7. マージ

## コードスタイル

- TypeScript の型を適切に付ける（`any` は極力避ける）
- Hono のルーティング規則に従う
- React コンポーネントは関数コンポーネントで記述
- DB スキーマ変更は必ずマイグレーションファイルを追加

## 質問・議論

- バグ報告: [GitHub Issues](https://github.com/ikech4n/vulflare/issues)
- 機能提案: [GitHub Issues](https://github.com/ikech4n/vulflare/issues)
- セキュリティ: [SECURITY.md](SECURITY.md) を参照
