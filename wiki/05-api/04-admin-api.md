# 管理 API

## 概要

管理 API は、管理者（admin）がユーザーを管理するための REST API です。

## エンドポイント

### POST /api/admin/users

新規ユーザーを作成します。

#### リクエスト

```http
POST /api/admin/users
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "name": "山田太郎",
  "email": "yamada@example.com",
  "role": "staff",
  "requestType": "fix"
}
```

#### ヘッダー

| ヘッダー | 必須 | 説明 |
|---------|:----:|------|
| Content-Type | ✅ | application/json |
| Authorization | ✅ | Bearer トークン |

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| name | string | ✅ | ユーザー名 |
| email | string | ✅ | メールアドレス（一意） |
| role | string | ✅ | staff / reviewer / admin |
| requestType | string | ✅ | fix / flex |

#### レスポンス

##### 成功 (201)

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "yamada@example.com",
    "name": "山田太郎",
    "role": "staff",
    "requestType": "fix",
    "active": true
  }
}
```

##### エラー (400)

```json
{
  "error": "メールアドレスが既に使用されています"
}
```

##### エラー (401)

```json
{
  "error": "認証が必要です"
}
```

##### エラー (403)

```json
{
  "error": "管理者権限が必要です"
}
```

### PATCH /api/admin/users

既存ユーザーを更新します。

#### リクエスト

```http
PATCH /api/admin/users
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "山田次郎",
  "email": "yamada2@example.com",
  "role": "reviewer",
  "requestType": "flex"
}
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| id | string | ✅ | ユーザーID |
| name | string | - | ユーザー名 |
| email | string | - | メールアドレス |
| role | string | - | staff / reviewer / admin |
| requestType | string | - | fix / flex |
| active | boolean | - | 有効/無効 |

#### レスポンス

##### 成功 (200)

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "yamada2@example.com",
    "name": "山田次郎",
    "role": "reviewer",
    "requestType": "flex",
    "active": true
  }
}
```

## 認証・認可

### Bearer トークン

API 呼び出しには、Supabase セッションの `access_token` を使用します。

```typescript
const token = session?.access_token;

const response = await fetch("/api/admin/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});
```

### 権限チェック

サーバーサイドで admin ロールを確認：

```typescript
// route.ts 内
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json(
    { error: "認証が必要です" },
    { status: 401 }
  );
}

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

## ユーザー作成の詳細

### Supabase Admin API

ユーザー作成には `supabase.auth.admin.createUser` を使用：

```typescript
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  email_confirm: true, // メール確認をスキップ
  user_metadata: { name },
});
```

### プロファイル作成

認証ユーザー作成後、profiles テーブルにレコードを作成：

```typescript
await supabaseAdmin
  .from("profiles")
  .insert({
    id: data.user.id,
    email,
    name,
    role,
    request_type: requestType,
    active: true,
  });
```

## クライアントからの呼び出し

### ユーザー作成

```typescript
const addUser = async (payload: {
  name: string;
  email: string;
  role: "staff" | "reviewer" | "admin";
  requestType: "fix" | "flex";
}) => {
  const token = session?.access_token;
  if (!token) return false;
  
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const data = await response.json();
    setError(data.error || "作成に失敗しました");
    return false;
  }
  
  await fetchUsers({ force: true });
  return true;
};
```

### ユーザー更新

```typescript
const updateUser = async (
  id: string,
  payload: Partial<{
    name: string;
    email: string;
    role: "staff" | "reviewer" | "admin";
    requestType: "fix" | "flex";
    active: boolean;
  }>
) => {
  const token = session?.access_token;
  if (!token) return false;
  
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, ...payload }),
  });
  
  if (!response.ok) {
    const data = await response.json();
    setError(data.error || "更新に失敗しました");
    return false;
  }
  
  await fetchUsers({ force: true });
  return true;
};
```

## バリデーション

### メールアドレス

- 有効なメール形式
- システム内で一意

### ロール

- `staff`, `reviewer`, `admin` のいずれか

### 申請タイプ

- `fix`, `flex` のいずれか

## エラーハンドリング

### 一般的なエラー

| エラー | 原因 | 対処 |
|--------|------|------|
| 認証が必要です | トークンなし/無効 | 再ログイン |
| 管理者権限が必要です | admin以外 | 権限確認 |
| メールアドレスが既に使用されています | 重複 | 別のメール使用 |
| ユーザーが見つかりません | 無効なID | ID確認 |

## 関連ドキュメント

- [API 概要](01-overview.md)
- [ユーザー管理](../03-features/03-admin-management.md)
- [認証・認可](../02-architecture/04-auth.md)
