# 監視・ログ

## 概要

notocord の監視とログ管理について説明します。

## 監視対象

### アプリケーション

- レスポンスタイム
- エラーレート
- ページビュー

### データベース

- 接続数
- クエリパフォーマンス
- ストレージ使用量

### 認証

- ログイン成功/失敗
- セッション数
- レート制限

## Vercel 監視

### Analytics

Vercel Dashboard → Analytics:

- ページビュー
- ユニーク訪問者
- 地域分布

### Web Vitals

- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

### Function Logs

Vercel Dashboard → Deployments → Functions:

- 実行ログ
- エラーログ
- パフォーマンスメトリクス

### 設定

```typescript
// app/layout.tsx
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## Supabase 監視

### Dashboard

#### Database → Health

- 接続数
- レイテンシー
- スループット

#### API → Logs

- リクエストログ
- エラーログ
- レスポンスタイム

#### Auth → Logs

- ログイン試行
- エラー
- セッション

### クエリパフォーマンス

```sql
-- 遅いクエリを特定
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### ストレージ使用量

```sql
-- テーブルサイズ
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text))
FROM pg_tables
WHERE schemaname = 'public';
```

## ログ設計

### アプリケーションログ

```typescript
// 構造化ログ
const log = {
  level: "error",
  message: "Request failed",
  timestamp: new Date().toISOString(),
  userId: user?.id,
  requestId: requestId,
  error: error.message,
};
console.error(JSON.stringify(log));
```

### カスタムログ

```typescript
// lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production" && level === "debug") {
    return;
  }
  
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  
  console[level](JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
```

## アラート設定

### Vercel

Settings → Notifications でアラートを設定。

### Supabase

Settings → Integrations でアラートを設定可能。

### 外部サービス

- Sentry (エラー追跡)
- Datadog (APM)
- PagerDuty (オンコール)

## メトリクス収集

### カスタムメトリクス

```typescript
// パフォーマンス計測
const start = performance.now();
await fetchData();
const duration = performance.now() - start;

// 記録
console.log(JSON.stringify({
  metric: "fetch_duration",
  value: duration,
  timestamp: Date.now(),
}));
```

## インシデント対応

### 検知

1. アラート受信
2. ログ確認
3. 影響範囲の特定

### 対応

1. 問題の切り分け
2. 一時対応（ロールバック等）
3. 根本原因の調査

### 報告

1. インシデントの記録
2. 原因と対策の文書化
3. 再発防止策の実施

## ダッシュボード

### 必要なメトリクス

- エラーレート
- レスポンスタイム（p50, p95, p99）
- 同時接続数
- データベース接続

### ツール

- Vercel Analytics
- Supabase Dashboard
- Grafana（カスタム）

## 関連ドキュメント

- [バックアップ](02-backup.md)
- [トラブルシューティング](../11-troubleshooting/01-common-issues.md)
- [デプロイ準備](../09-deployment/01-preparation.md)
