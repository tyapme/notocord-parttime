# Vercel デプロイ

## 概要

notocord を Vercel にデプロイする手順を説明します。

## 前提条件

- Vercel アカウント
- GitHub リポジトリ
- Supabase プロジェクト（設定済み）

## デプロイ手順

### 1. Vercel プロジェクトの作成

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. "Add New..." → "Project" をクリック
3. GitHub リポジトリを選択
4. "Import" をクリック

### 2. プロジェクト設定

#### Framework Preset

- Framework: Next.js
- Root Directory: `.` (デフォルト)
- Build Command: `pnpm build`
- Install Command: `pnpm install`

### 3. 環境変数の設定

"Environment Variables" セクションで以下を追加：

| 変数名 | 値 | Environment |
|--------|-----|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview |
| `FIRST_ADMIN_EMAIL` | `admin@example.com` | Production, Preview |

### 4. デプロイ実行

"Deploy" ボタンをクリック。

## 自動デプロイ

### ブランチ設定

- **Production**: `main` ブランチ
- **Preview**: プルリクエスト

### 設定変更

Settings → Git:
- Production Branch: `main`
- Automatic Deployments: Enabled

## カスタムドメイン

### ドメインの追加

1. Settings → Domains
2. ドメインを入力
3. DNS 設定を行う

### DNS 設定例

```
# A レコード
@ → 76.76.21.21

# CNAME レコード
www → cname.vercel-dns.com
```

### SSL

- 自動的に Let's Encrypt 証明書が発行されます

## ビルド設定

### Build & Development Settings

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "outputDirectory": ".next"
}
```

### Node.js バージョン

Settings → General → Node.js Version: `20.x`

## 環境別設定

### Production

- 本番環境用の環境変数
- カスタムドメイン

### Preview

- PR ごとにプレビュー URL が発行
- 本番と同じ環境変数（必要に応じて変更）

### Development

- ローカル開発用
- `.env.local` を使用

## Edge Functions

### 設定

`next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Edge Runtime を使用する場合
  experimental: {
    // ...
  },
};

export default nextConfig;
```

## Analytics

### 有効化

1. Settings → Analytics
2. "Enable Analytics" をクリック

### 確認

- ページビュー
- Web Vitals
- パフォーマンスメトリクス

## Vercel CLI

### インストール

```bash
npm install -g vercel
```

### ログイン

```bash
vercel login
```

### デプロイ

```bash
# プレビュー
vercel

# 本番
vercel --prod
```

### 環境変数の設定

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

## トラブルシューティング

### ビルド失敗

1. ビルドログを確認
2. ローカルで `pnpm build` を実行
3. 依存関係を確認

### 環境変数エラー

1. 変数名のスペルを確認
2. 値にクォートが含まれていないか確認
3. Environment の設定を確認

### 500 エラー

1. Function Logs を確認
2. 環境変数が正しく設定されているか確認
3. Supabase との接続を確認

## 関連ドキュメント

- [デプロイ準備](01-preparation.md)
- [Supabase 設定](03-supabase.md)
- [監視・ログ](../10-operations/01-monitoring.md)
