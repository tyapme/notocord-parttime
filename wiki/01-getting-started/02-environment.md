# 環境構築

## 開発環境の構築

### Node.js のインストール

#### nvm を使用する場合（推奨）

```bash
# nvm のインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Node.js 20 をインストール
nvm install 20
nvm use 20

# バージョン確認
node -v
```

#### 直接インストールする場合

[Node.js 公式サイト](https://nodejs.org/) から LTS バージョンをダウンロード。

### pnpm のインストール

```bash
# corepack を有効化
corepack enable

# pnpm を有効化
corepack prepare pnpm@latest --activate

# バージョン確認
pnpm -v
```

または npm でインストール：

```bash
npm install -g pnpm
```

## 環境変数の設定

### .env.local ファイル

```env
# ===================
# Supabase 設定
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===================
# 初回管理者設定
# ===================
FIRST_ADMIN_EMAIL=admin@your-company.com

# ===================
# オプション設定
# ===================
# デバッグモード
# DEBUG=true
```

### 環境変数の説明

| 変数名 | 必須 | 説明 |
|--------|:----:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクトの URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase の匿名キー（公開可能） |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase のサービスロールキー（非公開） |
| `FIRST_ADMIN_EMAIL` | ✅ | 初回管理者のメールアドレス |

### 環境変数の取得方法

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. Settings → API に移動
4. 以下の値をコピー：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

## エディタの設定

### VS Code 推奨拡張機能

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets"
  ]
}
```

### VS Code 設定

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Git の設定

### .gitignore

重要なファイルが含まれていることを確認：

```gitignore
# 環境変数
.env.local
.env.*.local

# 依存関係
node_modules/

# ビルド出力
.next/
out/

# その他
*.log
.DS_Store
```

### Git フック（husky）

コミット前のリント実行を設定する場合：

```bash
# husky のインストール
pnpm add -D husky

# 初期化
pnpm husky init

# pre-commit フックを追加
echo "pnpm lint" > .husky/pre-commit
```

## ローカル SSL 証明書（オプション）

PWA 機能をローカルでテストする場合：

```bash
# mkcert のインストール
brew install mkcert  # macOS
# または
choco install mkcert  # Windows

# ローカル CA のインストール
mkcert -install

# 証明書の生成
mkcert localhost
```

## 次のステップ

- [初回ログイン](03-first-login.md)
- [基本操作](04-basic-operations.md)
- [開発環境構築の詳細](../08-development/01-dev-setup.md)

## 関連ドキュメント

- [セットアップガイド](01-setup.md)
- [Supabase 設定](../09-deployment/03-supabase.md)
- [技術スタック](../02-architecture/02-tech-stack.md)
