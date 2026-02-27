# RPC 関数

## 概要

notocord の主要なデータ操作は、Supabase の RPC (Remote Procedure Call) を通じて行われます。すべての関数は `SECURITY DEFINER` で定義され、内部で認可チェックを行います。

## スタッフ向け関数

### request_fix

Fix タイプのシフト申請を作成します。

#### シグネチャ

```sql
request_fix(
  start_at timestamptz,
  end_at timestamptz,
  note text DEFAULT NULL
) RETURNS uuid
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| start_at | timestamptz | ✅ | 開始日時（ISO形式） |
| end_at | timestamptz | ✅ | 終了日時（ISO形式） |
| note | text | - | メッセージ |

#### 戻り値

新規作成された申請の `uuid`

#### 権限

- `staff` ロールのみ実行可能
- `request_type = 'fix'` のユーザーのみ

#### バリデーション

- `start_at < end_at`
- 勤務時間 ≤ 8時間
- 過去日は不可（JST基準）
- 3ヶ月先超は不可
- 既存の pending/approved Fix との重複不可

#### 呼び出し例

```typescript
const { data, error } = await supabase.rpc("request_fix", {
  start_at: "2026-03-01T09:00:00+09:00",
  end_at: "2026-03-01T17:00:00+09:00",
  note: "よろしくお願いします",
});
```

### request_flex

Flex タイプのシフト申請を作成します。

#### シグネチャ

```sql
request_flex(
  date_in_week date,
  requested_hours integer,
  note text DEFAULT NULL
) RETURNS uuid
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| date_in_week | date | ✅ | 対象週の任意の日 |
| requested_hours | integer | ✅ | 希望時間数 |
| note | text | - | メッセージ |

#### 権限

- `staff` ロールのみ実行可能
- `request_type = 'flex'` のユーザーのみ

#### バリデーション

- 1 ≤ requested_hours ≤ 40
- 過去週は不可（JST基準）
- 3ヶ月先超は不可
- 同一週の pending/approved との重複不可

#### 呼び出し例

```typescript
const { data, error } = await supabase.rpc("request_flex", {
  date_in_week: "2026-03-02",  // 週内の任意の日
  requested_hours: 20,
  note: "よろしくお願いします",
});
```

### update_fix_request

Fix 申請を編集します。

#### シグネチャ

```sql
update_fix_request(
  request_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  p_note text DEFAULT NULL
) RETURNS void
```

#### 権限

- 申請者本人のみ
- ステータスが `pending` のみ

### update_flex_request

Flex 申請を編集します。

#### シグネチャ

```sql
update_flex_request(
  request_id uuid,
  date_in_week date,
  p_requested_hours integer,
  p_note text DEFAULT NULL
) RETURNS void
```

#### 権限

- 申請者本人のみ
- ステータスが `pending` のみ

### withdraw_request

申請を取り下げます。

#### シグネチャ

```sql
withdraw_request(
  request_id uuid,
  p_reason text
) RETURNS void
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| request_id | uuid | ✅ | 申請ID |
| p_reason | text | ✅ | 取り下げ理由 |

#### 権限

- 申請者本人のみ
- ステータスが `pending` のみ

## レビュワー/管理者向け関数

### review_fix_request

Fix 申請を承認/却下します。

#### シグネチャ

```sql
review_fix_request(
  request_id uuid,
  p_decision_type text,
  p_approved_start_at timestamptz DEFAULT NULL,
  p_approved_end_at timestamptz DEFAULT NULL,
  p_change_reason text DEFAULT NULL,
  p_reviewer_note text DEFAULT NULL
) RETURNS void
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| request_id | uuid | ✅ | 申請ID |
| p_decision_type | text | ✅ | approve / modify / reject |
| p_approved_start_at | timestamptz | modify時 | 承認開始時刻 |
| p_approved_end_at | timestamptz | modify時 | 承認終了時刻 |
| p_change_reason | text | modify時 | 変更理由 |
| p_reviewer_note | text | - | レビュワーメッセージ |

#### 権限

- `reviewer` または `admin` ロール

#### 決定タイプ

| タイプ | 説明 |
|--------|------|
| approve | 申請内容をそのまま承認 |
| modify | 時間を変更して承認（理由必須） |
| reject | 却下 |

### review_flex_request

Flex 申請を承認/却下します。

#### シグネチャ

```sql
review_flex_request(
  request_id uuid,
  p_decision_type text,
  p_approved_hours integer DEFAULT NULL,
  p_reviewer_note text DEFAULT NULL
) RETURNS void
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| request_id | uuid | ✅ | 申請ID |
| p_decision_type | text | ✅ | approve / modify / reject |
| p_approved_hours | integer | modify時 | 承認時間数 |
| p_reviewer_note | text | - | レビュワーメッセージ |

### cancel_approved_request

承認済みの申請を取り消します。

#### シグネチャ

```sql
cancel_approved_request(
  request_id uuid,
  p_reason text
) RETURNS void
```

#### 権限

- `reviewer` または `admin` ロール
- ステータスが `approved` のみ

## 代理作成関数

### proxy_create_fix_request

Fix 申請を代理で作成します（即承認）。

#### シグネチャ

```sql
proxy_create_fix_request(
  user_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  note text DEFAULT NULL
) RETURNS uuid
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| user_id | uuid | ✅ | 対象スタッフのID |
| start_at | timestamptz | ✅ | 開始日時 |
| end_at | timestamptz | ✅ | 終了日時 |
| note | text | - | メッセージ |

#### 権限

- `reviewer` または `admin` ロール
- 対象ユーザーの `request_type = 'fix'`

### proxy_create_flex_request

Flex 申請を代理で作成します（即承認）。

#### シグネチャ

```sql
proxy_create_flex_request(
  user_id uuid,
  date_in_week date,
  requested_hours integer,
  note text DEFAULT NULL
) RETURNS uuid
```

#### 権限

- `reviewer` または `admin` ロール
- 対象ユーザーの `request_type = 'flex'`

## 再申請関数

### reopen_fix_request

却下/取り下げされた Fix 申請を再申請します。

#### シグネチャ

```sql
reopen_fix_request(
  request_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  p_note text DEFAULT NULL
) RETURNS void
```

### reopen_flex_request

却下/取り下げされた Flex 申請を再申請します。

#### シグネチャ

```sql
reopen_flex_request(
  request_id uuid,
  date_in_week date,
  p_requested_hours integer,
  p_note text DEFAULT NULL
) RETURNS void
```

## セキュリティ

### SECURITY DEFINER

すべての関数は `SECURITY DEFINER` で定義され、呼び出し元のユーザー権限ではなく、関数の所有者（通常は postgres）の権限で実行されます。

### 内部認可チェック

```sql
-- 関数内でのロールチェック例
SELECT role INTO v_role
FROM profiles
WHERE id = auth.uid();

IF v_role IS DISTINCT FROM 'staff' THEN
  RAISE EXCEPTION 'Permission denied';
END IF;
```

## 関連ドキュメント

- [API 概要](01-overview.md)
- [スキーマ設計](../06-database/01-schema.md)
- [RLS ポリシー](../06-database/02-rls.md)
