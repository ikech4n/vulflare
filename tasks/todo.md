# パッケージ監査機能（OSV API連携）実装

## Status: In Progress

## Tasks

- [ ] Step 1: DBマイグレーション（055_package_audit.sql）
- [ ] Step 2: 共有型定義（audit.ts, vulnerability.ts更新）
- [ ] Step 3: Lockfileパーサー（lockfile-parsers.ts）
- [ ] Step 4: OSV APIクライアント（osv-api.ts）
- [ ] Step 5: リポジトリ層（audit-repository.ts）
- [ ] Step 6: スキャンサービス（audit-scan.ts）
- [ ] Step 7: APIルート（audit.ts + index.ts更新）
- [ ] Step 8: 通知（notifications.ts更新）
- [ ] Step 9: フロントエンド（Pages + Components + Router + Sidebar）
- [ ] Step 10: 型チェック・ビルド検証
- [ ] Step 11: コミット

## Notes

- yamlパッケージなし → pnpm-lock.yaml は正規表現でパース
- VulnSource: "osv"追加
- EventType: "package_audit_critical"追加
