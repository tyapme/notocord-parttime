# チュートリアル: 開発環境の構築

## 概要

このチュートリアルでは、notocord の開発環境を一から構築する手順を説明します。

## 所要時間

約30分

## ステップ 1: 前提ソフトウェアのインストール

### Node.js

```bash
# nvm のインストール（macOS/Linux）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# ターミナルを再起動後
nvm install 20
nvm use 20

# バージョン確認
node -v  # v20.x.x
```

### pnpm

```bash
# corepack を有効化
corepack enable

# pnpm を有効化
corepack prepare pnpm@latest --activate

# バージョン確認
pnpm -v  # 8.x.x
```

### Git

```bash
# macOS
brew install git

# Ubuntu
sudo apt install git

# バージョン確認
git --version
```

## ステップ 2: リポジトリのクローン

```bash
# SSH の場合
git clone git@github.com:your-org/notocord-parttime.git

# HTTPS の場合
git clone https://github.com/your-org/notocord-parttime.git

# ディレクトリに移動
cd notocord-parttime
```

## ステップ 3: 依存関係のインストール

```bash
pnpm install
```

## ステップ 4: 環境変数の設定

### .env.local の作成

```bash
cp .env.example .env.local
```

### Supabase の設定

1. [Supabase Dashboard](https://supabase.com/dashboard) にアクセス
2. プロジェクトを選択（または新規作成）
3. Settings → API に移動
4. 以下の値をコピー

### .env.local の編集

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...（anon key）
SUPABASE_SERVICE_ROLE_KEY=eyJ...（service_role key）
FIRST_ADMIN_EMAIL=your-email@example.com
```

## ステップ 5: データベースのセットアップ

### Supabase Dashboard で実行

1. SQL Editor を開く
2. `supabase/phase1.sql` の内容をペースト
3. Run を実行

### または Supabase CLI

```bash
# CLI のインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトのリンク
supabase link --project-ref your-project-ref

# マイグレーション適用
supabase db push
```

## ステップ 6: 開発サーバーの起動

```bash
pnpm dev
```

ブラウザで http://localhost:3000 にアクセス。

## ステップ 7: 初回ログイン

1. FIRST_ADMIN_EMAIL で設定したメールアドレスでログイン
2. 認証コードがメールに届く
3. コードを入力してログイン

## 確認ポイント

- [ ] `node -v` が v20.x.x
- [ ] `pnpm -v` が 8.x.x
- [ ] `pnpm install` が正常終了
- [ ] `.env.local` が設定済み
- [ ] データベースのマイグレーションが完了
- [ ] `pnpm dev` でサーバーが起動
- [ ] http://localhost:3000 にアクセス可能
- [ ] 初回ログインが成功

## トラブルシューティング

### pnpm install でエラー

```bash
rm -rf node_modules
pnpm store prune
pnpm install
```

### 環境変数エラー

- `.env.local` のスペルを確認
- Supabase の値が正しいか確認

### ポート 3000 が使用中

```bash
pnpm dev -p 3001
```

### マジックリンクが届かない

- 迷惑メールフォルダを確認
- Supabase の SMTP 設定を確認

## 次のステップ

- [コーディング規約](../08-development/02-coding-standards.md)
- [テスト戦略](../08-development/03-testing.md)
- [デバッグ手法](../08-development/04-debugging.md)
