# コーディング規約

## 概要

notocord プロジェクトで遵守すべきコーディング規約を定義します。

## 一般原則

### 1. 可読性を優先

- わかりやすい変数名・関数名を使用
- 複雑なロジックにはコメントを追加
- 関数は単一責任を持つ

### 2. 一貫性を保つ

- 既存のコードスタイルに従う
- ESLint ルールを遵守
- フォーマッタを使用

### 3. シンプルに保つ

- 過度な抽象化を避ける
- 必要になるまで最適化しない
- YAGNI (You Aren't Gonna Need It)

## TypeScript

### 型定義

```typescript
// 明示的な型定義
interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

// 型エイリアス
type Role = "staff" | "reviewer" | "admin";
type Status = "pending" | "approved" | "rejected" | "withdrawn";
```

### 型推論の活用

```typescript
// 推論可能な場合は省略可
const count = 0;  // number と推論
const name = "test";  // string と推論

// 明示が必要な場合
const items: Item[] = [];
```

### null / undefined の扱い

```typescript
// Optional chaining
const userName = user?.name;

// Nullish coalescing
const displayName = userName ?? "Unknown";

// Type guard
function isFixRequest(req: Request): req is FixRequest {
  return req.type === "fix";
}
```

## React

### コンポーネント

```typescript
// 関数コンポーネントを使用
interface ButtonProps {
  variant?: "default" | "destructive";
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = "default", children, onClick }: ButtonProps) {
  return (
    <button
      className={cn("btn", variant === "destructive" && "btn-destructive")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

### フック

```typescript
// カスタムフックは use で始める
function useRequests() {
  const requests = useAppStore((s) => s.requests);
  const fetchRequests = useAppStore((s) => s.fetchRequests);
  
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);
  
  return requests;
}
```

### イベントハンドラ

```typescript
// handle + 動詞 の命名
const handleSubmit = async (data: FormData) => {
  // ...
};

const handleClick = () => {
  // ...
};
```

## スタイリング

### Tailwind CSS

```tsx
// ユーティリティクラスを使用
<div className="flex items-center gap-2 p-4 rounded-lg bg-surface">
  {children}
</div>

// cn() で条件付きクラス
<button
  className={cn(
    "btn",
    isActive && "btn-active",
    isDisabled && "btn-disabled"
  )}
>
  Click
</button>
```

### CVA (class-variance-authority)

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## ファイル構成

### コンポーネントファイル

```
components/
├── ui/
│   ├── button.tsx      # 単一エクスポート
│   └── card.tsx
├── login-screen.tsx    # 複合コンポーネント
└── status-badge.tsx
```

### ページファイル

```
app/
├── page.tsx           # ルートページ
├── layout.tsx         # レイアウト
└── review/
    ├── page.tsx       # /review
    └── review-request-modal.tsx  # ページ固有コンポーネント
```

## 命名規則

### ファイル名

- コンポーネント: `kebab-case.tsx` (例: `status-badge.tsx`)
- ユーティリティ: `kebab-case.ts` (例: `request-urgency.ts`)
- 型定義: `types.ts`

### 変数・関数

- camelCase: `userName`, `fetchRequests`
- 定数: `UPPER_SNAKE_CASE` (例: `CACHE_TTL_MS`)
- 型/インターフェース: `PascalCase` (例: `User`, `FixRequest`)
- コンポーネント: `PascalCase` (例: `StatusBadge`)

## 非同期処理

### async/await を使用

```typescript
// 推奨
async function fetchData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 避ける
function fetchData() {
  return fetch(url)
    .then(response => response.json())
    .then(data => data)
    .catch(error => {
      console.error(error);
      throw error;
    });
}
```

## エラーハンドリング

```typescript
// 明示的なエラーハンドリング
const { data, error } = await supabase.rpc("request_fix", params);

if (error) {
  set({ error: error.message });
  return false;
}

// 成功処理
return true;
```

## コメント

```typescript
// 単一行コメント
const result = calculate(value);

/**
 * 複数行コメント（JSDoc）
 * @param value - 入力値
 * @returns 計算結果
 */
function calculate(value: number): number {
  return value * 2;
}

// TODO: 後で実装
// FIXME: バグ修正が必要
// NOTE: 注意事項
```

## インポート順序

```typescript
// 1. React / Next.js
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// 2. 外部ライブラリ
import { z } from "zod";
import { useForm } from "react-hook-form";

// 3. 内部モジュール
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

// 4. 型定義
import type { User, Request } from "@/lib/types";
```

## 関連ドキュメント

- [開発環境構築](01-dev-setup.md)
- [テスト戦略](03-testing.md)
- [コンポーネント設計](../04-components/01-overview.md)
