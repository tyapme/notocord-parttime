# Supabase 設定

## 概要

notocord で使用する Supabase の設定について説明します。

## プロジェクト作成

### 1. Supabase にログイン

[Supabase Dashboard](https://supabase.com/dashboard) にアクセス。

### 2. 新規プロジェクト作成

1. "New Project" をクリック
2. Organization を選択
3. プロジェクト情報を入力:
   - Name: `notocord-production`
   - Database Password: 強力なパスワード
   - Region: `ap-northeast-1` (Tokyo)
4. "Create new project" をクリック

### 3. API キーの取得

Settings → API:
- Project URL
- anon (public) key
- service_role key

## データベース設定

### マイグレーション適用

SQL Editor で `supabase/phase1.sql` を実行。

### RLS 確認

```sql
-- RLS が有効か確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- すべて true であること
```

### インデックス確認

```sql
-- インデックス一覧
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public';
```

## 認証設定

### Auth → Settings

#### General

- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/**`

#### Email

- Enable Email Signup: Enabled
- Confirm Email: Disabled (OTP 使用のため)
- Email OTP Expiration: 300 (秒)

### Email Templates

Auth → Email Templates でカスタマイズ：

#### OTP メール

```html
<h2>認証コード</h2>
<p>以下のコードを入力してログインしてください：</p>
<h1>{{ .Token }}</h1>
<p>このコードは {{ .TokenHashExpiration }} 分間有効です。</p>
```

## SMTP 設定

### 本番環境では外部 SMTP を推奨

Settings → Auth → SMTP Settings:

| 項目 | 例 |
|------|-----|
| Host | smtp.sendgrid.net |
| Port | 587 |
| Username | apikey |
| Password | SG.xxxxxx |
| Sender email | noreply@your-domain.com |
| Sender name | notocord |

## API 設定

### Rate Limiting

Settings → API → Rate Limiting:

| エンドポイント | 制限 |
|---------------|------|
| Default | 100 req/s |
| Auth endpoints | 30 req/min |

### CORS

Settings → API → CORS:

許可するオリジン:
- `https://your-domain.com`
- `https://your-app.vercel.app`

## セキュリティ設定

### Database → Security

- SSL Enforcement: Enabled
- Network Restrictions: 必要に応じて設定

### API Keys

- `anon` key: クライアントサイドで使用
- `service_role` key: サーバーサイドでのみ使用（非公開）

## バックアップ

### 自動バックアップ

Settings → Database → Backups:

- Automatic Backups: Enabled
- Point-in-Time Recovery: Enabled (Pro プラン)

### 手動バックアップ

```bash
# pg_dump でバックアップ
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

## 監視

### Dashboard

- Database → Health
- API → Logs

### アラート

Settings → Integrations でアラートを設定可能。

## Edge Functions（オプション）

### 作成

```bash
supabase functions new my-function
```

### デプロイ

```bash
supabase functions deploy my-function
```

## ローカル開発

### Supabase CLI

```bash
# インストール
npm install -g supabase

# ログイン
supabase login

# リンク
supabase link --project-ref <project-ref>

# ローカル起動
supabase start

# マイグレーション
supabase db push
```

### ローカル環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
```

## トラブルシューティング

### 接続エラー

1. URL とキーを確認
2. CORS 設定を確認
3. SSL 設定を確認

### 認証エラー

1. Auth 設定を確認
2. Redirect URLs を確認
3. SMTP 設定を確認

### パフォーマンス

1. インデックスを確認
2. クエリを最適化
3. プランのアップグレードを検討

## 関連ドキュメント

- [デプロイ準備](01-preparation.md)
- [Vercel デプロイ](02-vercel.md)
- [スキーマ設計](../06-database/01-schema.md)
