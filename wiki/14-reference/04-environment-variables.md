# 環境変数リファレンス

## 概要

notocord で使用する環境変数の一覧と説明です。

## 必須環境変数

### NEXT_PUBLIC_SUPABASE_URL

Supabase プロジェクトの URL。

| 項目 | 値 |
|------|-----|
| 必須 | ✅ |
| 公開 | ✅ |
| 形式 | `https://xxxxxxxx.supabase.co` |
| 取得場所 | Supabase Dashboard → Settings → API → Project URL |

**例**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
```

### NEXT_PUBLIC_SUPABASE_ANON_KEY

Supabase の匿名キー（公開可能）。

| 項目 | 値 |
|------|-----|
| 必須 | ✅ |
| 公開 | ✅ |
| 形式 | JWT 形式の文字列 |
| 取得場所 | Supabase Dashboard → Settings → API → anon (public) |

**例**:
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### SUPABASE_SERVICE_ROLE_KEY

Supabase のサービスロールキー（非公開）。

| 項目 | 値 |
|------|-----|
| 必須 | ✅ |
| 公開 | ❌ |
| 形式 | JWT 形式の文字列 |
| 取得場所 | Supabase Dashboard → Settings → API → service_role |

**⚠️ 注意**: このキーは絶対に公開しないでください。

**例**:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### FIRST_ADMIN_EMAIL

初回管理者のメールアドレス。

| 項目 | 値 |
|------|-----|
| 必須 | ✅ |
| 公開 | ❌ |
| 形式 | メールアドレス |
| 用途 | システム初期化時の管理者作成 |

**例**:
```env
FIRST_ADMIN_EMAIL=admin@example.com
```

## オプション環境変数

### NODE_ENV

実行環境。

| 項目 | 値 |
|------|-----|
| 必須 | ❌ |
| 公開 | ✅ |
| 値 | `development` / `production` / `test` |
| デフォルト | `development` |

**例**:
```env
NODE_ENV=production
```

## 環境別設定

### 開発環境 (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FIRST_ADMIN_EMAIL=dev-admin@example.com
```

### 本番環境 (Vercel)

Vercel Dashboard → Settings → Environment Variables で設定。

| 変数 | Production | Preview | Development |
|------|:----------:|:-------:|:-----------:|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | ✅ | ✅ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | ✅ | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ | ❌ |
| FIRST_ADMIN_EMAIL | ✅ | ✅ | ❌ |

## セキュリティガイドライン

### 公開可能な変数

`NEXT_PUBLIC_` プレフィックスが付いた変数はクライアントサイドで参照可能。

```typescript
// クライアントで利用可能
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
```

### 非公開変数

`NEXT_PUBLIC_` プレフィックスがない変数はサーバーサイドでのみ参照可能。

```typescript
// サーバーサイドでのみ利用可能
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### 絶対に公開しない

- `SUPABASE_SERVICE_ROLE_KEY`
- データベースパスワード
- API シークレット

## トラブルシューティング

### 環境変数が読み込まれない

1. ファイル名を確認（`.env.local`）
2. 変数名のスペルを確認
3. サーバーを再起動

### NEXT_PUBLIC_ 変数がクライアントで undefined

1. プレフィックスが正しいか確認
2. ビルドし直す

### 本番環境で動作しない

1. Vercel の環境変数を確認
2. デプロイし直す

## 関連ドキュメント

- [環境構築](../01-getting-started/02-environment.md)
- [デプロイ準備](../09-deployment/01-preparation.md)
- [Supabase 設定](../09-deployment/03-supabase.md)
