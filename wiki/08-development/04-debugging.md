# デバッグ手法

## 概要

notocord の開発時に役立つデバッグ手法を説明します。

## ブラウザ開発者ツール

### Console

```typescript
// デバッグログ
console.log("データ:", data);
console.error("エラー:", error);
console.table(requests); // テーブル形式で表示

// グループ化
console.group("Request Processing");
console.log("Step 1:", step1);
console.log("Step 2:", step2);
console.groupEnd();
```

### Network タブ

- API リクエスト/レスポンスの確認
- タイミングの分析
- エラーの特定

### React Developer Tools

Chrome/Firefox 拡張機能をインストール。

- コンポーネントツリーの確認
- Props/State の確認
- パフォーマンス分析

## Zustand DevTools

### 設定

```typescript
import { devtools } from "zustand/middleware";

const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // ...
    }),
    { name: "AppStore" }
  )
);
```

### 使用

Redux DevTools 拡張機能で状態の変化を確認。

## VS Code デバッグ

### launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

## よくある問題のデバッグ

### 認証エラー

```typescript
// セッションの確認
const { data: { session }, error } = await supabase.auth.getSession();
console.log("Session:", session);
console.log("Error:", error);

// ユーザー情報
const { data: { user } } = await supabase.auth.getUser();
console.log("User:", user);
```

### RPC エラー

```typescript
const { data, error } = await supabase.rpc("request_fix", params);

if (error) {
  console.error("RPC Error:", error.message);
  console.error("Details:", error.details);
  console.error("Hint:", error.hint);
}
```

### 状態の確認

```typescript
// Zustand ストアの状態
const state = useAppStore.getState();
console.log("Current User:", state.currentUser);
console.log("Requests:", state.requests);
console.log("Loading:", state.dataLoading);
```

### レンダリングの確認

```typescript
// 再レンダリングの追跡
useEffect(() => {
  console.log("Component rendered");
});

// 依存関係の確認
useEffect(() => {
  console.log("Dependencies changed:", { dep1, dep2 });
}, [dep1, dep2]);
```

## Supabase デバッグ

### SQL クエリの確認

Supabase Dashboard の SQL Editor で直接クエリを実行。

```sql
-- プロファイルの確認
SELECT * FROM profiles WHERE email = 'test@example.com';

-- 申請の確認
SELECT * FROM shift_requests WHERE user_id = 'uuid';

-- RLS の確認
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "user-uuid"}';
SELECT * FROM shift_requests;
```

### ログの確認

Supabase Dashboard → Logs

- Auth Logs: 認証関連
- Postgres Logs: データベース関連
- API Logs: API 呼び出し

## パフォーマンスデバッグ

### React Profiler

```tsx
import { Profiler } from "react";

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  console.log(`${id} rendered in ${actualDuration}ms`);
}

<Profiler id="RequestList" onRender={onRenderCallback}>
  <RequestList />
</Profiler>
```

### メモリリーク

```typescript
// クリーンアップの確認
useEffect(() => {
  const subscription = subscribe();
  
  return () => {
    subscription.unsubscribe(); // クリーンアップ
  };
}, []);
```

## エラーバウンダリ

```tsx
// components/error-boundary.tsx
"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <h2>エラーが発生しました</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## デバッグのベストプラクティス

### 1. 段階的に確認

問題を小さく分割して確認。

### 2. ログは意味のある情報を

```typescript
// 良い例
console.log(`User ${userId} request failed:`, error);

// 悪い例
console.log(error);
```

### 3. 本番環境ではログを削除

```typescript
if (process.env.NODE_ENV === "development") {
  console.log("Debug:", data);
}
```

### 4. 再現可能な状態を作る

問題が再現できる手順を特定。

## 関連ドキュメント

- [開発環境構築](01-dev-setup.md)
- [テスト戦略](03-testing.md)
- [トラブルシューティング](../11-troubleshooting/01-common-issues.md)
