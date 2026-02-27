# 権限管理

## 概要

notocord では、ロールベースアクセス制御 (RBAC) を使用して権限を管理しています。

## ロール定義

### staff（スタッフ）

一般的なシフト勤務者。

**できること:**
- 自分のシフト申請を作成
- 自分の申請を編集（pending のみ）
- 自分の申請を取り下げ（pending のみ）
- 自分の申請履歴を確認

**できないこと:**
- 他人の申請を参照
- 申請を承認/却下
- ユーザーを管理

### reviewer（レビュワー）

シフト承認担当者。

**できること:**
- すべての申請を参照
- 申請を承認/変更承認/却下
- 代理申請を作成
- 承認済み申請を取り消し
- すべてのユーザー情報を参照

**できないこと:**
- ユーザーを作成/編集
- ユーザーを有効/無効化

### admin（管理者）

システム管理者。

**できること:**
- reviewer のすべての機能
- ユーザーを作成
- ユーザーを編集
- ユーザーを有効/無効化

## 権限チェックの実装

### UI レベル

```typescript
// components/app-shell.tsx
const allowedTabs = useMemo(() => {
  const role = currentUser?.role;
  
  if (role === "admin") {
    return ["home", "review", "proxy", "users", "admin"];
  }
  if (role === "reviewer") {
    return ["home", "review", "proxy", "users"];
  }
  // staff
  return ["home", "new", "my"];
}, [currentUser?.role]);
```

### API レベル

```typescript
// /api/admin/users
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .single();

if (profile?.role !== "admin") {
  return NextResponse.json(
    { error: "管理者権限が必要です" },
    { status: 403 }
  );
}
```

### RPC レベル

```sql
-- 関数内でのロールチェック
CREATE FUNCTION request_fix(...)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_request_type text;
BEGIN
  -- ロールと request_type を取得
  SELECT role, request_type INTO v_role, v_request_type
  FROM profiles
  WHERE id = auth.uid() AND active = true;
  
  -- staff のみ許可
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;
  
  -- request_type が fix のみ許可
  IF v_request_type IS DISTINCT FROM 'fix' THEN
    RAISE EXCEPTION 'Permission denied: fix type only';
  END IF;
  
  -- 処理続行...
END;
$$;
```

### RLS レベル

```sql
-- staff は自分の申請のみ参照
CREATE POLICY "shift_requests_select_own_staff"
ON shift_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'staff'
    AND active = true
  )
  AND user_id = auth.uid()
);
```

## 権限マトリクス

### 申請操作

| 操作 | staff | reviewer | admin |
|------|:-----:|:--------:|:-----:|
| 自分の申請作成 | ✅ | - | - |
| 自分の申請編集 | ✅ | - | - |
| 自分の申請取り下げ | ✅ | - | - |
| 他人の申請参照 | ✗ | ✅ | ✅ |
| 申請承認 | ✗ | ✅ | ✅ |
| 代理申請作成 | ✗ | ✅ | ✅ |
| 承認取消 | ✗ | ✅ | ✅ |

### ユーザー操作

| 操作 | staff | reviewer | admin |
|------|:-----:|:--------:|:-----:|
| 自分のプロファイル参照 | ✅ | ✅ | ✅ |
| 他人のプロファイル参照 | ✗ | ✅ | ✅ |
| ユーザー作成 | ✗ | ✗ | ✅ |
| ユーザー編集 | ✗ | ✗ | ✅ |
| ユーザー有効/無効 | ✗ | ✗ | ✅ |

### データ参照

| データ | staff | reviewer | admin |
|--------|:-----:|:--------:|:-----:|
| 自分の申請 | ✅ | ✅ | ✅ |
| 他人の申請 | ✗ | ✅ | ✅ |
| 自分の履歴 | ✅ | ✅ | ✅ |
| 他人の履歴 | ✗ | ✅ | ✅ |
| 全ユーザー一覧 | ✗ | ✅ | ✅ |

## 申請タイプの制限

### request_type

各ユーザーには `request_type` が設定されています。

| タイプ | 説明 |
|--------|------|
| fix | 固定シフト（日時指定）のみ申請可能 |
| flex | フレックスシフト（週単位時間）のみ申請可能 |

### 制限の実装

```sql
-- Fix 申請時
IF v_request_type IS DISTINCT FROM 'fix' THEN
  RAISE EXCEPTION 'This user can only create flex requests';
END IF;

-- Flex 申請時
IF v_request_type IS DISTINCT FROM 'flex' THEN
  RAISE EXCEPTION 'This user can only create fix requests';
END IF;
```

## 無効ユーザーの処理

### ログイン時

```typescript
// 無効ユーザーはログイン不可
if (!profile.active) {
  await supabase.auth.signOut();
  return;
}
```

### RLS

```sql
-- active = true のみ許可
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND active = true
  )
)
```

### 既存セッション

無効化されたユーザーは次回の認証チェックで自動ログアウト。

## ベストプラクティス

### 1. 最小権限の原則

必要最小限の権限のみ付与。

### 2. 定期的な棚卸し

不要な権限を削除。

### 3. 監査ログ

権限変更を履歴として記録。

### 4. 段階的な権限付与

必要に応じて権限を昇格。

## 関連ドキュメント

- [セキュリティ概要](01-overview.md)
- [認証フロー](02-auth-flow.md)
- [RLS ポリシー](../06-database/02-rls.md)
