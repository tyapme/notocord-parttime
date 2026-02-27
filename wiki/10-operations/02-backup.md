# バックアップ

## 概要

notocord のデータバックアップ戦略について説明します。

## バックアップ対象

| 対象 | 重要度 | 頻度 |
|------|--------|------|
| データベース | 高 | 日次 |
| 環境変数 | 高 | 変更時 |
| ソースコード | 高 | コミット時 |
| 設定ファイル | 中 | 変更時 |

## データベースバックアップ

### Supabase 自動バックアップ

Settings → Database → Backups:

- **Daily Backups**: 過去7日間（Free プラン）
- **Point-in-Time Recovery**: 過去7日間（Pro プラン）

### 手動バックアップ

#### pg_dump

```bash
# フルバックアップ
PGPASSWORD=your-password pg_dump \
  -h db.xxx.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_$(date +%Y%m%d).dump

# スキーマのみ
pg_dump -h db.xxx.supabase.co -U postgres -d postgres --schema-only > schema.sql

# データのみ
pg_dump -h db.xxx.supabase.co -U postgres -d postgres --data-only > data.sql
```

#### Supabase CLI

```bash
# バックアップ
supabase db dump -f backup.sql

# スキーマのみ
supabase db dump --schema-only -f schema.sql
```

### 復元

```bash
# pg_restore
PGPASSWORD=your-password pg_restore \
  -h db.xxx.supabase.co \
  -U postgres \
  -d postgres \
  -c \
  backup.dump

# psql
psql -h db.xxx.supabase.co -U postgres -d postgres < backup.sql
```

## 環境変数バックアップ

### Vercel

```bash
# 環境変数のエクスポート
vercel env pull .env.backup

# または手動でコピー
# Dashboard → Settings → Environment Variables
```

### 安全な保管

- パスワードマネージャー
- 暗号化されたストレージ
- アクセス制限

## ソースコードバックアップ

### Git

- GitHub/GitLab でホスト
- 複数のリモートリポジトリ

```bash
# リモートの追加
git remote add backup git@backup-server:repo.git

# すべてのリモートにプッシュ
git push --all origin
git push --all backup
```

## バックアップスケジュール

| 対象 | 頻度 | 保持期間 |
|------|------|----------|
| DB (Supabase) | 日次 | 7日 |
| DB (手動) | 週次 | 30日 |
| 環境変数 | 変更時 | 永続 |
| ソースコード | コミット時 | 永続 |

## 復元テスト

### 定期テスト

- 四半期ごとに復元テストを実施
- ステージング環境で検証

### テスト手順

1. バックアップファイルを取得
2. テスト環境にデータベースを作成
3. バックアップを復元
4. データの整合性を確認
5. アプリケーションの動作確認

## 災害復旧

### Recovery Point Objective (RPO)

最大許容データ損失: 24時間

### Recovery Time Objective (RTO)

最大許容ダウンタイム: 4時間

### 手順

1. 最新バックアップの特定
2. 新しい Supabase プロジェクトの作成
3. バックアップの復元
4. 環境変数の設定
5. アプリケーションの再デプロイ
6. DNS の更新（必要に応じて）

## バックアップの検証

### チェックリスト

- [ ] バックアップファイルが存在する
- [ ] ファイルサイズが妥当
- [ ] チェックサムが一致
- [ ] 復元テストが成功

### 自動化

```bash
#!/bin/bash
# backup-verify.sh

BACKUP_FILE="backup_$(date +%Y%m%d).dump"

# ファイル存在確認
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found"
  exit 1
fi

# サイズ確認
SIZE=$(stat -f%z "$BACKUP_FILE")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: Backup file too small"
  exit 1
fi

echo "Backup verification passed"
```

## セキュリティ

### 暗号化

```bash
# バックアップの暗号化
gpg --symmetric --cipher-algo AES256 backup.dump

# 復号
gpg --decrypt backup.dump.gpg > backup.dump
```

### アクセス制御

- バックアップへのアクセスを制限
- 監査ログの有効化
- 定期的なアクセス権の見直し

## 関連ドキュメント

- [監視・ログ](01-monitoring.md)
- [Supabase 設定](../09-deployment/03-supabase.md)
- [マイグレーション](../06-database/03-migrations.md)
