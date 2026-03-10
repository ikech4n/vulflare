# Lessons Learned

## SQLite テーブル再作成時のインデックス漏れ

**日付**: 2026-02-27
**状況**: 脆弱性ステータス拡張マイグレーション（029）でテーブルを再作成した際に発生

**エラー**:
```
D1_ERROR: ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint
```

**原因**:
SQLite で CHECK 制約変更のためにテーブルを再作成する場合、元テーブルの全インデックスを手動で再作成しなければならない。
`jvn-sync.ts` の `ON CONFLICT(cve_id)` が動作するには `cve_id` に **UNIQUE インデックス** が必要だったが、再作成時に通常の INDEX として作ってしまった。

**ルール**:
1. SQLite テーブル再作成マイグレーションを書くときは、元のマイグレーション履歴を全て確認して既存インデックスを洗い出す
2. `ON CONFLICT(col)` を使う upsert は、その列が PRIMARY KEY か **UNIQUE** インデックスであることが必須
3. テーブル再作成後は `CREATE UNIQUE INDEX` / `CREATE INDEX` の区別に注意する
4. 元スキーマの `published_at` のような追加インデックスも漏れなく再作成する

**修正**: `030_fix_cve_unique_index.sql` で UNIQUE インデックスを再作成。029 の SQL 自体も修正済み。

---

## D1 テーブル再作成時の「dangling FK」エラー

**日付**: 2026-02-27
**状況**: users テーブルから email カラム削除（031）でテーブルを再作成しようとした際に発生

**エラー**:
```
no such table: main.assets: SQLITE_ERROR [code: 7500]
```

**原因**:
`scan_imports` テーブルが `FOREIGN KEY (asset_id) REFERENCES assets(id)` を持っているが、`assets` は migration 026 で削除済み。
D1 は `DROP TABLE users` または `ALTER TABLE RENAME` 時に、users を参照する他テーブル（scan_imports）の全 FK を再帰的にバリデーションする。
そのため、scan_imports の「壊れた」FK（assets が存在しない）が引っかかってエラーになる。

`ALTER TABLE users DROP COLUMN email` は `UNIQUE` カラムを削除できないため使えない。

**ルール**:
1. テーブルを再作成するマイグレーションを書くときは、そのテーブルを参照する他テーブルに「壊れた FK」がないか確認する
2. `UNIQUE` カラムを持つテーブルは `ALTER TABLE DROP COLUMN` で削除できない（テーブル再作成が必要）
3. 過去のマイグレーションで削除されたテーブルを参照しているテーブルが残っていないか確認する
4. 修正方法: メインテーブルの再作成より先に、dangling FK を持つテーブルも再作成して FK を除去する

**修正**: `031_remove_user_email.sql` で scan_imports から assets への dangling FK を先に除去してから users を再作成。

## D1 FK制約はデフォルト有効 — 挿入順序に注意

**日付**: 2026-03-10
**状況**: `jvn_product_cache` に製品データをINSERTしようとした際に500エラーが発生

**エラー**:
```
FOREIGN KEY constraint failed: D1_ERROR [code: 7500]
```

**原因**:
D1（SQLite互換）はデフォルトで `PRAGMA foreign_keys = ON` が有効。
`jvn_product_cache.vendor_vid` → `jvn_vendor_cache.vid` の FK制約があるため、
ベンダーをINSERTする前に製品をINSERTしようとすると制約違反になる。
ベンダーキャッシュが空の状態（未取得）で製品API呼び出し → 500エラー。

**ルール**:
1. D1でFKを持つテーブルへINSERTする前に、参照先テーブルへのINSERTを先に行う
2. 子テーブルへのINSERT前に親テーブルを `ON CONFLICT DO NOTHING` でUPSERTするパターンが安全
3. FK制約バグはクリーンDBでのテストでしか再現しない（既存データがある場合は気づかない）
4. FK制約を持つテーブルを新規作成したら、必ず「参照先が存在しない状態でINSERTする」統合テストを書く

**修正**: 製品取得ルートで `jvn_product_cache` へのINSERT前に `jvn_vendor_cache` への UPSERT を追加。

---

## Rules of Hooks 違反に注意
- viewer チェックなどの条件的な早期リターンを追加するとき、それが hook の呼び出しの**途中**に挿入されていないか必ず確認する
- 早期リターンは**すべての hook が呼ばれた後**に配置すること
- 違反するとアプリ全体がクラッシュし、ログインページにも到達できなくなる
