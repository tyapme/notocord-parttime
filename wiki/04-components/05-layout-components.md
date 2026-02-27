# レイアウトコンポーネント

## 概要

notocord のレイアウトに関連するコンポーネントについて説明します。

## app/layout.tsx

ルートレイアウト。すべてのページで共有される最上位のレイアウト。

### 構成

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "notocord",
  description: "シフト管理システム",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

### 役割

- HTML 構造の定義
- メタデータの設定
- グローバルスタイルの適用
- フォントの設定

## AppShell

アプリケーション全体のシェル。認証状態に応じた表示切り替え。

### 構成

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { AppNav } from "./app-nav";
import { LoginScreen } from "./login-screen";

export function AppShell({ children }: { children: React.ReactNode }) {
  const init = useAppStore((s) => s.init);
  const currentUser = useAppStore((s) => s.currentUser);
  const authLoading = useAppStore((s) => s.authLoading);
  const initialized = useAppStore((s) => s.initialized);

  useEffect(() => {
    init();
  }, [init]);

  // ロールに基づくタブ
  const allowedTabs = useMemo(() => {
    // ...
  }, [currentUser?.role]);

  // ローディング中
  if (!initialized || authLoading) {
    return <LoadingScreen />;
  }

  // 未ログイン
  if (!currentUser) {
    return <LoginScreen />;
  }

  // ログイン済み
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-16">{children}</main>
      <AppNav allowedTabs={allowedTabs} />
    </div>
  );
}
```

### 機能

1. 認証状態の初期化
2. ローディング表示
3. ログイン画面表示
4. ナビゲーション表示
5. コンテンツエリア

## AppNav

下部ナビゲーションバー。

### 構成

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AppNavProps {
  allowedTabs: string[];
}

export function AppNav({ allowedTabs }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t">
      <div className="flex justify-around items-center h-16">
        {allowedTabs.map((tab) => (
          <Link
            key={tab}
            href={`/${tab}`}
            className={cn(
              "flex flex-col items-center",
              pathname.startsWith(`/${tab}`) && "text-primary"
            )}
          >
            {getTabIcon(tab)}
            <span className="text-xs">{getTabLabel(tab)}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

### タブ定義

| タブ | パス | ロール |
|------|------|--------|
| home | /home | 全員 |
| new | /new | staff |
| my | /my | staff |
| review | /review | reviewer, admin |
| proxy | /shift/proxy | reviewer, admin |
| users | /users | reviewer, admin |
| admin | /admin | admin |

## RootRouteShell

ルートルートのラッパー。

### 構成

```tsx
import { AppShell } from "@/components/app-shell";

export function RootRouteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
```

## ページレイアウト

### 基本構造

```tsx
export default function MyPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">タイトル</h1>
      
      <div className="space-y-4">
        {/* コンテンツ */}
      </div>
    </div>
  );
}
```

### タブ付きページ

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReviewPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">承認管理</h1>
      
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">承認待ち</TabsTrigger>
          <TabsTrigger value="all">すべて</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          {/* 承認待ち一覧 */}
        </TabsContent>
        
        <TabsContent value="all">
          {/* すべて一覧 */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## レスポンシブ対応

### ブレークポイント

| プレフィックス | 最小幅 |
|---------------|--------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |

### 例

```tsx
<div className="px-4 md:px-6 lg:px-8">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* カード */}
  </div>
</div>
```

## 関連ドキュメント

- [コンポーネント概要](../04-components/01-overview.md)
- [カスタムコンポーネント](../04-components/03-custom-components.md)
- [技術スタック](../02-architecture/02-tech-stack.md)
