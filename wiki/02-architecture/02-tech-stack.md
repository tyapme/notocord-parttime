# 技術スタック

## 概要

notocord は、モダンな Web 技術を採用したシフト管理システムです。本ドキュメントでは、使用している技術とその選定理由を説明します。

## フロントエンド

### フレームワーク

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 16.x | フルスタック React フレームワーク |
| React | 19.x | UI ライブラリ |
| TypeScript | 5.7.x | 型安全な JavaScript |

#### Next.js の採用理由
- App Router による効率的なルーティング
- サーバーコンポーネントのサポート
- 優れた開発体験
- Vercel との統合

### 状態管理

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Zustand | 5.x | グローバル状態管理 |

#### Zustand の採用理由
- 軽量でシンプルな API
- TypeScript との相性が良い
- ボイラープレートが少ない
- React 19 対応

### UI コンポーネント

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Radix UI | 最新 | アクセシブルなプリミティブ |
| shadcn/ui | 最新 | Radix UI ベースのコンポーネント |
| Lucide React | 0.564.x | アイコンライブラリ |

### スタイリング

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Tailwind CSS | 4.x | ユーティリティファースト CSS |
| class-variance-authority | 0.7.x | コンポーネントバリアント |
| tailwind-merge | 3.x | クラス名のマージ |

### フォーム

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React Hook Form | 7.x | フォーム管理 |
| Zod | 3.x | スキーマバリデーション |

### ユーティリティ

| 技術 | バージョン | 用途 |
|------|-----------|------|
| date-fns | 4.x | 日付操作 |
| clsx | 2.x | 条件付きクラス名 |

## バックエンド

### BaaS (Backend as a Service)

| 技術 | 用途 |
|------|------|
| Supabase | データベース・認証・API |

#### Supabase の構成要素
- **PostgreSQL**: リレーショナルデータベース
- **Auth**: 認証・セッション管理
- **RPC**: セキュアなデータベース関数呼び出し
- **RLS**: Row Level Security

### API

| 技術 | 用途 |
|------|------|
| Next.js API Routes | サーバーサイド API |
| @supabase/ssr | SSR 対応 Supabase クライアント |

## 開発ツール

### ビルドツール

| 技術 | 用途 |
|------|------|
| pnpm | パッケージマネージャー |
| PostCSS | CSS 処理 |
| Autoprefixer | ベンダープレフィックス自動追加 |

### コード品質

| 技術 | 用途 |
|------|------|
| ESLint | JavaScript/TypeScript リンター |
| TypeScript | 静的型チェック |

### デプロイ

| サービス | 用途 |
|---------|------|
| Vercel | ホスティング・CI/CD |
| Supabase | データベースホスティング |

## 依存関係一覧

### 本番依存関係

```json
{
  "@hookform/resolvers": "^3.9.1",
  "@radix-ui/react-*": "各種バージョン",
  "@supabase/ssr": "^0.8.0",
  "@supabase/supabase-js": "^2.49.1",
  "@vercel/analytics": "1.6.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "1.1.1",
  "date-fns": "4.1.0",
  "lucide-react": "^0.564.0",
  "next": "16.1.6",
  "next-themes": "^0.4.6",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "react-hook-form": "^7.54.1",
  "recharts": "2.15.0",
  "sonner": "^1.7.1",
  "tailwind-merge": "^3.3.1",
  "vaul": "^1.1.2",
  "zod": "^3.24.1",
  "zustand": "^5.0.5"
}
```

### 開発依存関係

```json
{
  "@tailwindcss/postcss": "^4.2.0",
  "@types/node": "^22",
  "@types/react": "19.2.14",
  "@types/react-dom": "19.2.3",
  "eslint": "^9.21.0",
  "eslint-config-next": "16.1.6",
  "postcss": "^8.5",
  "tailwindcss": "^4.2.0",
  "tw-animate-css": "1.3.3",
  "typescript": "5.7.3"
}
```

## バージョン管理方針

### Semantic Versioning
- 依存関係は Semantic Versioning に従う
- セキュリティアップデートは即座に適用
- メジャーアップデートは慎重に評価

### 更新タイミング
- セキュリティ: 即時
- バグ修正: 月次
- 機能追加: 四半期

## 関連ドキュメント

- [システム構成](01-system-overview.md)
- [データフロー](03-data-flow.md)
- [開発環境構築](../08-development/01-dev-setup.md)
