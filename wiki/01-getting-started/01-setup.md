# セットアップガイド

## 前提条件

本システムをセットアップするには、以下の前提条件が必要です：

### 必須ソフトウェア
- Node.js 20.x 以上
- pnpm 8.x 以上
- Git 2.x 以上

### アカウント
- Supabase アカウント
- Vercel アカウント（本番デプロイ用）

## クイックスタート

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

`.env.local` を編集して必要な値を設定：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 初回管理者
FIRST_ADMIN_EMAIL=admin@example.com
```

### 4. Supabase のセットアップ

#### 4.1 プロジェクト作成
1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. 新規プロジェクトを作成
3. プロジェクトの URL と API キーを取得

#### 4.2 データベースのマイグレーション

```bash
# Supabase CLI をインストール
npm install -g supabase

# ログイン
supabase login

# マイグレーションを適用
supabase db push
```

または、Supabase Dashboard の SQL Editor で `supabase/phase1.sql` を実行。

### 5. 開発サーバーの起動

```bash
pnpm dev
```

ブラウザで http://localhost:3000 にアクセス。

## 初回ログイン

1. `FIRST_ADMIN_EMAIL` で設定したメールアドレスでログイン
2. マジックリンクがメールに届く
3. リンクをクリックしてログイン完了
4. 管理者として初期設定を行う

## 次のステップ

- [環境構築の詳細](02-environment.md)
- [初回ログイン](03-first-login.md)
- [基本操作](04-basic-operations.md)

## トラブルシューティング

### よくある問題

#### pnpm install でエラーが発生する
```bash
# Node.js バージョンを確認
node -v  # v20.x 以上が必要

# キャッシュをクリア
pnpm store prune
pnpm install
```

#### Supabase 接続エラー
- 環境変数が正しく設定されているか確認
- Supabase プロジェクトが起動しているか確認
- API キーの有効期限を確認

#### マジックリンクが届かない
- メールアドレスが正しいか確認
- 迷惑メールフォルダを確認
- Supabase のメール設定を確認

## 関連ドキュメント

- [環境構築](02-environment.md)
- [Supabase 設定](../09-deployment/03-supabase.md)
- [トラブルシューティング](../11-troubleshooting/01-common-issues.md)
