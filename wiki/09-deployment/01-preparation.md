# デプロイ準備

## 概要

notocord を本番環境にデプロイするための準備について説明します。

## 前提条件

### 必要なアカウント

- [Supabase](https://supabase.com) アカウント
- [Vercel](https://vercel.com) アカウント（推奨）

### 必要な情報

- Supabase プロジェクト URL
- Supabase API キー
- 初回管理者のメールアドレス

## チェックリスト

### デプロイ前確認

- [ ] ビルドが成功する (`pnpm build`)
- [ ] リントエラーがない (`pnpm lint`)
- [ ] 環境変数が設定されている
- [ ] データベースマイグレーションが完了している
- [ ] 初回管理者メールが設定されている

### セキュリティ確認

- [ ] service_role キーは非公開
- [ ] 環境変数に機密情報を含めない
- [ ] RLS ポリシーが有効

## 環境変数

### 必須変数

| 変数名 | 説明 | 公開 |
|--------|------|:----:|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名キー | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー | ✗ |
| `FIRST_ADMIN_EMAIL` | 初回管理者メール | ✗ |

### 環境変数の取得

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. Settings → API
4. 以下をコピー:
   - Project URL
   - anon (public) key
   - service_role key

## ビルド確認

### ローカルビルド

```bash
# ビルド実行
pnpm build

# 本番モードで起動
pnpm start
```

### ビルドエラーの解消

- TypeScript エラーを修正
- 依存関係の問題を解決
- 環境変数を確認

## データベース準備

### マイグレーション

```bash
# Supabase CLI で適用
supabase db push
```

または Supabase Dashboard の SQL Editor で `supabase/phase1.sql` を実行。

### RLS 確認

```sql
-- RLS が有効か確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 初期データ

必要に応じて初期データを投入。

## ドメイン設定

### カスタムドメイン

1. ドメインを購入/準備
2. DNS 設定
3. Vercel でドメイン追加
4. SSL 証明書（自動）

### Supabase の設定

Auth → URL Configuration:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/**`

## メール設定

### SMTP 設定（本番環境）

Supabase Dashboard → Settings → Auth → SMTP Settings

推奨サービス:
- SendGrid
- Postmark
- Amazon SES

### テンプレートのカスタマイズ

Auth → Email Templates でカスタマイズ可能。

## 本番環境設定

### Supabase

- Rate Limiting の設定
- Backup の有効化
- Monitoring の設定

### Vercel

- Environment Variables の設定
- Build & Development Settings の確認
- Analytics の有効化（オプション）

## ロールバック計画

### データベース

- バックアップからの復元手順
- マイグレーションのロールバック SQL

### アプリケーション

- 前のデプロイに戻す方法
- 環境変数のバックアップ

## 関連ドキュメント

- [Vercel デプロイ](02-vercel.md)
- [Supabase 設定](03-supabase.md)
- [監視・ログ](../10-operations/01-monitoring.md)
