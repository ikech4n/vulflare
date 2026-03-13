# 優先度高3機能 実装完了

## 実装済み

- [x] Step 1: DBマイグレーション (`migrations/039_assignee_duedate_history.sql`)
  - `vulnerabilities` テーブルに `assignee_id`, `due_date` 列追加
  - `vulnerability_history` テーブル新規作成
- [x] Step 2: バックエンド — 担当者・期限
  - `DbVulnerability` に `assignee_id`, `due_date` 追加
  - `vulnRepo.list()` に担当者フィルタ・JOINを追加
  - `vulnRepo.create()` / `update()` に対応フィールド追加
  - バリデーションスキーマに `assigneeId`, `dueDate` 追加
  - ルートハンドラで assignee 存在確認
- [x] Step 3: バックエンド — 変更履歴
  - `vulnHistoryRepo` 新規追加（create / listByVulnId）
  - 作成・更新・一括更新・削除時に履歴記録
  - `GET /api/vulnerabilities/:id/history` 追加
- [x] Step 4: バックエンド — CSVインポート
  - `POST /api/reports/vulnerabilities/csv/import` 追加（skip/update モード）
  - CSVエクスポートに `Assignee`, `Due Date` 列追加
- [x] Step 5: フロントエンド — 担当者・期限
  - VulnerabilitiesPage: 担当者フィルタ、担当者・期限列、期限超過の赤表示
  - VulnerabilityDetailPage: 担当者・期限の表示・編集
  - VulnerabilityCreatePage: 担当者・期限フィールド追加
- [x] Step 6: フロントエンド — 変更履歴
  - VulnerabilityDetailPage: 変更履歴タイムライン（ページネーション付き）
- [x] Step 7: フロントエンド — CSVインポート
  - `CsvImportModal` コンポーネント新規作成
  - VulnerabilitiesPage に「CSVインポート」ボタン追加
- [x] Step 8: 検証
  - `pnpm type-check` → パス
  - `pnpm test` → 58件全パス
  - `pnpm build:web` → ビルド成功

## レビュー

実装は計画通り完了。主な変更ファイル:
- `migrations/039_assignee_duedate_history.sql` (新規)
- `apps/worker/src/db/repository.ts`
- `apps/worker/src/routes/vulnerabilities.ts`
- `apps/worker/src/routes/reports.ts`
- `apps/worker/src/validation/schemas.ts`
- `packages/shared/src/types/vulnerability.ts`
- `apps/web/src/pages/VulnerabilitiesPage.tsx`
- `apps/web/src/pages/VulnerabilityDetailPage.tsx`
- `apps/web/src/pages/VulnerabilityCreatePage.tsx`
- `apps/web/src/components/CsvImportModal.tsx` (新規)
