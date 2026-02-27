# テスト戦略

## 概要

notocord のテスト戦略について説明します。

## テストピラミッド

```
      /\
     /  \      E2E テスト
    /----\     
   /      \    統合テスト
  /--------\   
 /          \  ユニットテスト
/______________\
```

### ユニットテスト

個々の関数やコンポーネントをテスト。

- ユーティリティ関数
- カスタムフック
- 純粋なコンポーネント

### 統合テスト

複数のコンポーネントや API との連携をテスト。

- フォーム送信フロー
- 認証フロー
- データ取得・更新

### E2E テスト

ユーザーの操作フローをテスト。

- ログインから申請作成まで
- 承認ワークフロー

## テストツール

### 推奨ツール

| ツール | 用途 |
|--------|------|
| Vitest | ユニットテスト |
| React Testing Library | コンポーネントテスト |
| Playwright | E2E テスト |
| MSW | API モック |

## ユニットテスト例

### ユーティリティ関数

```typescript
// lib/datetime.test.ts
import { describe, it, expect } from "vitest";
import { formatDate, parseTime } from "./datetime";

describe("formatDate", () => {
  it("should format date correctly", () => {
    const date = new Date("2026-03-01");
    expect(formatDate(date)).toBe("2026/03/01");
  });
});

describe("parseTime", () => {
  it("should parse time string", () => {
    expect(parseTime("09:00")).toBe(540); // 9 * 60
    expect(parseTime("17:30")).toBe(1050); // 17 * 60 + 30
  });
});
```

### カスタムフック

```typescript
// hooks/use-requests.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useRequests } from "./use-requests";

describe("useRequests", () => {
  it("should fetch requests on mount", async () => {
    const { result } = renderHook(() => useRequests());
    
    await waitFor(() => {
      expect(result.current.requests).toHaveLength(2);
    });
  });
});
```

## コンポーネントテスト例

```typescript
// components/status-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("should render pending status", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("保留中")).toBeInTheDocument();
  });

  it("should render approved status", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText("確定")).toBeInTheDocument();
  });
});
```

## 統合テスト例

```typescript
// app/new/new-request-page.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import NewRequestPage from "./page";

vi.mock("@/lib/store", () => ({
  useAppStore: () => ({
    currentUser: { id: "1", role: "staff", requestType: "fix" },
    addFixRequest: vi.fn().mockResolvedValue(true),
  }),
}));

describe("NewRequestPage", () => {
  it("should submit fix request", async () => {
    render(<NewRequestPage />);
    
    // フォーム入力
    fireEvent.change(screen.getByLabelText("開始時刻"), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText("終了時刻"), {
      target: { value: "17:00" },
    });
    
    // 送信
    fireEvent.click(screen.getByText("申請する"));
    
    await waitFor(() => {
      expect(screen.getByText("申請が完了しました")).toBeInTheDocument();
    });
  });
});
```

## E2E テスト例

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test("should login with OTP", async ({ page }) => {
    await page.goto("/");
    
    // メールアドレス入力
    await page.fill('input[type="email"]', "test@example.com");
    await page.click('button:text("認証コードを送信")');
    
    // コード入力（テスト環境では固定コード）
    await page.fill('input[type="text"]', "123456");
    await page.click('button:text("ログイン")');
    
    // ホーム画面に遷移
    await expect(page).toHaveURL("/home");
  });
});
```

## モック

### Supabase モック

```typescript
// __mocks__/supabase.ts
import { vi } from "vitest";

export const supabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
    }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null }),
  })),
  rpc: vi.fn().mockResolvedValue({ data: "uuid", error: null }),
};
```

### MSW によるAPI モック

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/api/auth/send-code", () => {
    return HttpResponse.json({ ok: true });
  }),
  
  http.post("/api/admin/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ok: true,
      data: { id: "new-id", ...body },
    });
  }),
];
```

## テストカバレッジ

### 目標カバレッジ

| 種別 | 目標 |
|------|------|
| ユーティリティ | 90%+ |
| フック | 80%+ |
| コンポーネント | 70%+ |
| 全体 | 75%+ |

### カバレッジレポート

```bash
# カバレッジレポート生成
pnpm test:coverage
```

## テストのベストプラクティス

### 1. テストは独立させる

各テストは他のテストに依存しない。

### 2. 意味のあるテスト名

何をテストしているか明確にする。

```typescript
// 良い例
it("should show error when email is invalid", () => {});

// 悪い例
it("test1", () => {});
```

### 3. AAA パターン

Arrange（準備）、Act（実行）、Assert（検証）。

```typescript
it("should add request", async () => {
  // Arrange
  const store = useAppStore.getState();
  
  // Act
  const result = await store.addFixRequest({ ... });
  
  // Assert
  expect(result).toBe(true);
});
```

## 関連ドキュメント

- [開発環境構築](01-dev-setup.md)
- [コーディング規約](02-coding-standards.md)
- [デバッグ手法](04-debugging.md)
