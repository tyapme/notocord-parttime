# 開発環境構築

## 概要

notocord の開発環境を構築するための詳細なガイドです。

## 必要なソフトウェア

### Node.js

バージョン 20.x 以上が必要です。

```bash
# nvm を使用する場合
nvm install 20
nvm use 20

# バージョン確認
node -v
```

### pnpm

パッケージマネージャーとして pnpm を使用します。

```bash
# corepack で有効化
corepack enable
corepack prepare pnpm@latest --activate

# バージョン確認
pnpm -v
```

### Git

```bash
# バージョン確認
git --version
```

## プロジェクトのセットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/notocord-parttime.git
cd notocord-parttime
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を編集:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FIRST_ADMIN_EMAIL=admin@example.com
```

### 4. 開発サーバーの起動

```bash
pnpm dev
```

http://localhost:3000 でアクセス。

## ディレクトリ構造

```
notocord-parttime/
├── app/                    # Next.js App Router
│   ├── admin/              # 管理画面
│   ├── api/                # API Routes
│   ├── home/               # ホーム
│   ├── my/                 # 自分の申請
│   ├── new/                # 新規申請
│   ├── review/             # 承認
│   └── ...
├── components/             # コンポーネント
│   └── ui/                 # UI コンポーネント
├── hooks/                  # カスタムフック
├── lib/                    # ユーティリティ
│   ├── supabase/           # Supabase クライアント
│   ├── store.ts            # Zustand ストア
│   └── types.ts            # 型定義
├── public/                 # 静的ファイル
├── styles/                 # スタイル
├── supabase/               # DB 定義
└── wiki/                   # ドキュメント
```

## 開発ツール

### ESLint

```bash
# リント実行
pnpm lint

# 自動修正
pnpm lint:fix
```

### TypeScript

```bash
# 型チェック
pnpm tsc --noEmit
```

### ビルド

```bash
# 本番ビルド
pnpm build
```

## VS Code 設定

### 推奨拡張機能

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets

### settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Supabase ローカル開発

### Supabase CLI のインストール

```bash
npm install -g supabase
supabase login
```

### ローカル環境の起動

```bash
supabase start
```

### マイグレーションの適用

```bash
supabase db push
```

## デバッグ

### React Developer Tools

Chrome/Firefox 拡張機能をインストール。

### コンソールログ

```typescript
// 開発時のみログ出力
if (process.env.NODE_ENV === "development") {
  console.log("Debug:", data);
}
```

### ネットワークタブ

ブラウザの開発者ツールでリクエスト/レスポンスを確認。

## ホットリロード

開発サーバーは自動的にホットリロードを行います。

- `.tsx` / `.ts` ファイルの変更: 自動リロード
- `.env.local` の変更: サーバー再起動が必要

## トラブルシューティング

### pnpm install でエラー

```bash
# キャッシュクリア
pnpm store prune
rm -rf node_modules
pnpm install
```

### ポート競合

```bash
# ポートを変更して起動
pnpm dev -p 3001
```

### 型エラー

```bash
# 型定義を再生成
pnpm tsc --build --clean
```

## 関連ドキュメント

- [コーディング規約](02-coding-standards.md)
- [テスト戦略](03-testing.md)
- [デバッグ手法](04-debugging.md)
