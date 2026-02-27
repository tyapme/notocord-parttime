# バリデーションルール

## 概要

notocord で使用されるバリデーションルールについて説明します。

## Fix 申請のバリデーション

### クライアントサイド

```typescript
const fixRequestSchema = z.object({
  date: z.date({
    required_error: "日付を選択してください",
  }),
  startTime: z.string()
    .regex(/^\d{2}:\d{2}$/, "時刻形式が不正です"),
  endTime: z.string()
    .regex(/^\d{2}:\d{2}$/, "時刻形式が不正です"),
  note: z.string().optional(),
}).refine(
  (data) => parseTime(data.endTime) > parseTime(data.startTime),
  { message: "終了時刻は開始時刻より後にしてください", path: ["endTime"] }
).refine(
  (data) => getDurationHours(data.startTime, data.endTime) <= 8,
  { message: "勤務時間は8時間以内にしてください", path: ["endTime"] }
);
```

### サーバーサイド（RPC）

```sql
-- 時間の順序
IF p_start_at >= p_end_at THEN
  RAISE EXCEPTION 'End time must be after start time';
END IF;

-- 8時間制限
IF EXTRACT(EPOCH FROM (p_end_at - p_start_at)) / 3600 > 8 THEN
  RAISE EXCEPTION 'Duration must be 8 hours or less';
END IF;

-- 過去日チェック
IF p_start_at < (CURRENT_DATE AT TIME ZONE 'Asia/Tokyo')::timestamptz THEN
  RAISE EXCEPTION 'Cannot create request for past dates';
END IF;

-- 3ヶ月先チェック
IF p_start_at > (CURRENT_DATE + INTERVAL '3 months') THEN
  RAISE EXCEPTION 'Cannot create request more than 3 months ahead';
END IF;

-- 重複チェック
IF EXISTS (
  SELECT 1 FROM shift_requests
  WHERE user_id = auth.uid()
    AND type = 'fix'
    AND status IN ('pending', 'approved')
    AND id != COALESCE(p_request_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND requested_start_at < p_end_at
    AND requested_end_at > p_start_at
) THEN
  RAISE EXCEPTION 'Overlapping request exists';
END IF;
```

## Flex 申請のバリデーション

### クライアントサイド

```typescript
const flexRequestSchema = z.object({
  week: z.string().min(1, "対象週を選択してください"),
  hours: z.number()
    .min(1, "1時間以上を入力してください")
    .max(40, "40時間以内にしてください"),
  note: z.string().optional(),
});
```

### サーバーサイド（RPC）

```sql
-- 時間数の範囲
IF p_requested_hours < 1 OR p_requested_hours > 40 THEN
  RAISE EXCEPTION 'Hours must be between 1 and 40';
END IF;

-- 過去週チェック
IF v_week_start_date < date_trunc('week', CURRENT_DATE)::date THEN
  RAISE EXCEPTION 'Cannot create request for past weeks';
END IF;

-- 3ヶ月先チェック
IF v_week_start_date > (CURRENT_DATE + INTERVAL '3 months') THEN
  RAISE EXCEPTION 'Cannot create request more than 3 months ahead';
END IF;

-- 重複チェック（ユニークインデックスで制御）
```

## ユーザー管理のバリデーション

### クライアントサイド

```typescript
const userSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  role: z.enum(["staff", "reviewer", "admin"]),
  requestType: z.enum(["fix", "flex"]),
});
```

### サーバーサイド

```typescript
// メールアドレスの一意性
const { data: existing } = await supabase
  .from("profiles")
  .select("id")
  .eq("email", email)
  .single();

if (existing) {
  return { error: "メールアドレスが既に使用されています" };
}
```

## 承認のバリデーション

### 変更承認（Fix）

```typescript
const modifyFixSchema = z.object({
  approvedStartAt: z.string(),
  approvedEndAt: z.string(),
  changeReason: z.string().min(1, "変更理由は必須です"),
  reviewerNote: z.string().optional(),
}).refine(
  (data) => parseTime(data.approvedEndAt) > parseTime(data.approvedStartAt),
  { message: "終了時刻は開始時刻より後にしてください" }
).refine(
  (data) => getDurationHours(data.approvedStartAt, data.approvedEndAt) <= 8,
  { message: "勤務時間は8時間以内にしてください" }
);
```

### 変更承認（Flex）

```typescript
const modifyFlexSchema = z.object({
  approvedHours: z.number()
    .min(1, "1時間以上を入力してください")
    .max(40, "40時間以内にしてください"),
  reviewerNote: z.string().optional(),
});
```

### 取り下げ/取消

```typescript
const withdrawSchema = z.object({
  reason: z.string().min(1, "理由は必須です"),
});
```

## データベース制約

### CHECK 制約

```sql
-- profiles
CHECK (role IN ('admin', 'reviewer', 'staff'))
CHECK (request_type IN ('fix', 'flex'))

-- shift_requests
CHECK (type IN ('fix', 'flex'))
CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn'))
CHECK (decision_type IN ('approve', 'modify', 'partial', 'reject'))
CHECK (requested_hours > 0)
CHECK (approved_hours > 0)

-- Fix の時間制約
CONSTRAINT fix_times_valid CHECK (
  type != 'fix' OR requested_start_at < requested_end_at
)

-- Fix 変更承認の理由必須
CONSTRAINT fix_modify_reason CHECK (
  type != 'fix' OR decision_type != 'modify' OR change_reason IS NOT NULL
)
```

### ユニーク制約

```sql
-- profiles のメールアドレス
UNIQUE (email)

-- Flex の週単位一意性
CREATE UNIQUE INDEX shift_requests_flex_unique
ON shift_requests (user_id, iso_year, iso_week)
WHERE type = 'flex' AND status IN ('pending', 'approved');
```

## エラーメッセージ

### 日本語エラーメッセージ

| ルール | メッセージ |
|--------|-----------|
| 必須 | 〇〇は必須です |
| 形式不正 | 〇〇の形式が不正です |
| 範囲外 | 〇〇は△△の範囲で入力してください |
| 重複 | 〇〇は既に存在します |
| 過去日 | 過去の日付では申請できません |
| 未来日 | 3ヶ月以上先の日付では申請できません |

## 関連ドキュメント

- [RPC 関数](../05-api/03-rpc-functions.md)
- [スキーマ設計](../06-database/01-schema.md)
- [フォームコンポーネント](../04-components/04-form-components.md)
