# ビルドスクリプト

## 概要

notocord のビルドと開発に使用するスクリプトを説明します。

## package.json スクリプト

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix"
  }
}
```

## 開発サーバー

### 起動

```bash
pnpm dev
```

### オプション

```bash
# ポートを指定
pnpm dev -p 3001

# Turbopack を使用
pnpm dev --turbopack
```

### 動作

- http://localhost:3000 でサーバー起動
- ホットリロード有効
- エラーオーバーレイ表示

## ビルド

### 本番ビルド

```bash
pnpm build
```

### 出力

```
.next/
├── cache/            # ビルドキャッシュ
├── server/           # サーバーサイドコード
├── static/           # 静的アセット
└── BUILD_ID          # ビルド識別子
```

### ビルドログ

```
Route (app)                              Size     First Load JS
┌ ○ /                                    5.2 kB         89.1 kB
├ ○ /admin                              12.3 kB         96.2 kB
├ ○ /home                                4.8 kB         88.7 kB
├ ○ /my                                 15.6 kB         99.5 kB
├ ○ /new                                11.2 kB         95.1 kB
├ ○ /review                             18.4 kB        102.3 kB
...
```

## 本番サーバー

### 起動

```bash
pnpm start
```

### 前提

- `pnpm build` が完了していること
- `.next` ディレクトリが存在すること

## リント

### 実行

```bash
pnpm lint
```

### 自動修正

```bash
pnpm lint:fix
```

### 設定

`eslint.config.mjs`:

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
```

## 型チェック

### TypeScript コンパイル

```bash
pnpm tsc --noEmit
```

### watch モード

```bash
pnpm tsc --noEmit --watch
```

## カスタムスクリプト

### Supabase マイグレーション適用

```bash
# scripts/apply-supabase.sh
#!/bin/bash
supabase db push
```

### デザインシステム同期

```bash
# scripts/sync-design-system.mjs
// デザインシステムの同期処理
```

## CI/CD での使用

### GitHub Actions 例

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
          
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm build
```

## 環境別ビルド

### 環境変数の切り替え

```bash
# ステージング
cp .env.staging .env.local
pnpm build

# 本番
cp .env.production .env.local
pnpm build
```

### Vercel での環境変数

- Production: 本番環境変数
- Preview: プレビュー環境変数
- Development: 開発環境変数

## パフォーマンス分析

### バンドル分析

```bash
# 依存関係の追加
pnpm add -D @next/bundle-analyzer

# next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({})

# 実行
ANALYZE=true pnpm build
```

## 関連ドキュメント

- [開発環境構築](../08-development/01-dev-setup.md)
- [Vercel デプロイ](../09-deployment/02-vercel.md)
- [テスト戦略](../08-development/03-testing.md)
