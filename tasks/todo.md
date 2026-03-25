# 通知機能改善 タスクリスト

## Phase 1: バグ修正 — eol_expired ルール作成不可

- [ ] migrations/043_notification_improvements.sql — eol_expired・slack追加
- [ ] apps/worker/src/routes/notifications.ts — validEvents に eol_expired 追加

## Phase 2a: Toast導入

- [ ] apps/web/package.json — sonner 追加
- [ ] apps/web/src/main.tsx — <Toaster /> マウント

## Phase 2b: コンポーネント分割

- [ ] apps/web/src/hooks/useNotifications.ts — TanStack Query フック
- [ ] apps/web/src/components/notifications/ChannelForm.tsx
- [ ] apps/web/src/components/notifications/ChannelCard.tsx
- [ ] apps/web/src/components/notifications/ChannelList.tsx
- [ ] apps/web/src/components/notifications/RuleForm.tsx
- [ ] apps/web/src/components/notifications/RuleList.tsx
- [ ] apps/web/src/components/notifications/LogDetail.tsx
- [ ] apps/web/src/components/notifications/LogTable.tsx
- [ ] apps/web/src/pages/NotificationsPage.tsx — タブレイアウトのみに簡略化

## Phase 3: severityフィルタ強化

- [ ] apps/worker/src/services/notifications.ts — Array.isArray対応
- [ ] RuleForm.tsx — severityチェックボックス追加 (Phase 2bと同時)

## Phase 4: Slackチャネル追加

- [ ] packages/shared/src/types/notification.ts — slack追加
- [ ] apps/worker/src/routes/notifications.ts — slack バリデーション追加
- [ ] apps/worker/src/services/notifications.ts — sendSlack 追加

## Phase 5: 通知ログ改善

- [ ] apps/worker/src/db/notification-repository.ts — pagination・filter・findLogById追加
- [ ] apps/worker/src/routes/notifications.ts — GET /logs クエリパラメータ・POST /logs/:id/resend
- [ ] LogTable.tsx — フィルタ・ページネーション・再送信 (Phase 2bと同時)

## 検証

- [ ] pnpm type-check
- [ ] pnpm build:web
- [ ] pnpm test
