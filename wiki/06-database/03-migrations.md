# マイグレーション

## 概要

notocord のデータベースマイグレーションは、SQL ファイルを使用して管理されています。

## 現在のマイグレーション

### phase1.sql

Phase 1 の完全なデータベース定義を含むファイル。

**場所**: `supabase/phase1.sql`

**内容**:
- テーブル定義
- RLS ポリシー
- RPC 関数
- トリガー
- インデックス

## マイグレーションの適用

### Supabase Dashboard

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. SQL Editor を開く
4. `phase1.sql` の内容をペースト
5. Run を実行

### Supabase CLI

```bash
# Supabase CLI のインストール
npm install -g supabase

# ログイン
supabase login

# リンク
supabase link --project-ref <project-ref>

# マイグレーション適用
supabase db push
```

## マイグレーションの作成

### 新規マイグレーション

```bash
# マイグレーションファイルの作成
supabase migration new <migration_name>

# 例
supabase migration new add_notification_settings
```

### ファイル構成

```
supabase/
├── migrations/
│   ├── 20260201000000_initial.sql
│   ├── 20260215000000_add_index.sql
│   └── ...
└── phase1.sql
```

## マイグレーションのベストプラクティス

### 1. バックアップ

マイグレーション前に必ずバックアップを取得。

```bash
# Supabase Dashboard から
# Settings → Backups → Create Backup
```

### 2. テスト環境での確認

本番適用前にステージング環境で確認。

### 3. ロールバック計画

問題発生時のロールバック SQL を準備。

### 4. 増分マイグレーション

既存データを考慮した増分変更。

```sql
-- 良い例: 既存データを考慮
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_enabled boolean DEFAULT true;

-- 悪い例: データ損失の可能性
DROP TABLE profiles;
CREATE TABLE profiles (...);
```

## よくあるマイグレーション

### カラム追加

```sql
ALTER TABLE shift_requests
ADD COLUMN notification_sent boolean DEFAULT false;
```

### インデックス追加

```sql
CREATE INDEX CONCURRENTLY idx_shift_requests_created_at
ON shift_requests(created_at);
```

### RLS ポリシー追加

```sql
CREATE POLICY "new_policy"
ON shift_requests FOR SELECT
TO authenticated
USING (...);
```

### 関数の更新

```sql
CREATE OR REPLACE FUNCTION request_fix(...)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 新しい実装
END;
$$;
```

## 本番マイグレーションの手順

### 1. 準備

- [ ] バックアップ取得
- [ ] マイグレーション SQL 確認
- [ ] ロールバック SQL 準備
- [ ] ステージングでテスト完了

### 2. 実行

- [ ] メンテナンスモード開始（必要に応じて）
- [ ] マイグレーション実行
- [ ] 動作確認
- [ ] メンテナンスモード終了

### 3. 事後

- [ ] ログ確認
- [ ] 監視アラート確認
- [ ] ドキュメント更新

## トラブルシューティング

### マイグレーション失敗

1. エラーメッセージを確認
2. 部分適用の状態を確認
3. 必要に応じてロールバック

### ロック待ち

長時間のマイグレーションはテーブルロックに注意。

```sql
-- 同時実行可能なインデックス作成
CREATE INDEX CONCURRENTLY ...

-- タイムアウト設定
SET lock_timeout = '10s';
```

### データ移行

大量データの移行はバッチ処理で。

```sql
-- バッチ処理の例
DO $$
DECLARE
  batch_size int := 1000;
  offset_val int := 0;
BEGIN
  LOOP
    UPDATE shift_requests
    SET new_column = calculate_value(old_column)
    WHERE id IN (
      SELECT id FROM shift_requests
      ORDER BY id
      LIMIT batch_size OFFSET offset_val
    );
    
    EXIT WHEN NOT FOUND;
    offset_val := offset_val + batch_size;
    COMMIT;
  END LOOP;
END $$;
```

## 関連ドキュメント

- [スキーマ設計](01-schema.md)
- [RLS ポリシー](02-rls.md)
- [Supabase 設定](../09-deployment/03-supabase.md)
