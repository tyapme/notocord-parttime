# コンポーネント概要

## 概要

notocord のフロントエンドは、再利用可能なコンポーネントで構成されています。本ドキュメントでは、コンポーネントの全体構成と設計方針を説明します。

## コンポーネントディレクトリ構造

```
components/
├── ui/                         # 汎用 UI コンポーネント
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── app-nav.tsx                 # ナビゲーション
├── app-shell.tsx               # アプリケーションシェル
├── login-screen.tsx            # ログイン画面
├── shift-request-modal-frame.tsx # 申請モーダルフレーム
├── shift-request-ui.tsx        # 申請 UI
├── request-history-timeline.tsx # 履歴タイムライン
├── request-history-toggle.tsx  # 履歴トグル
├── status-badge.tsx            # ステータスバッジ
└── ...
```

## 設計方針

### 1. コンポジションパターン

小さなコンポーネントを組み合わせて大きなコンポーネントを構築：

```tsx
// 例: カード内にボタンを配置
<Card>
  <CardHeader>
    <CardTitle>タイトル</CardTitle>
  </CardHeader>
  <CardContent>
    内容
  </CardContent>
  <CardFooter>
    <Button>アクション</Button>
  </CardFooter>
</Card>
```

### 2. Radix UI ベース

アクセシビリティを考慮した UI プリミティブを使用：

- Dialog
- Dropdown Menu
- Select
- Tabs
- Toast
- など

### 3. Tailwind CSS によるスタイリング

ユーティリティクラスを使用したスタイリング：

```tsx
<div className="flex items-center gap-2 p-4 rounded-lg bg-surface">
  {children}
</div>
```

### 4. CVA による バリアント管理

class-variance-authority を使用したバリアント定義：

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## 主要コンポーネント

### アプリケーション構造

| コンポーネント | ファイル | 説明 |
|---------------|---------|------|
| AppShell | app-shell.tsx | アプリケーション全体のレイアウト |
| AppNav | app-nav.tsx | ナビゲーションバー |
| RootRouteShell | root-route-shell.tsx | ルートレイアウト |

### 認証

| コンポーネント | ファイル | 説明 |
|---------------|---------|------|
| LoginScreen | login-screen.tsx | ログイン画面 |

### 申請関連

| コンポーネント | ファイル | 説明 |
|---------------|---------|------|
| ShiftRequestUI | shift-request-ui.tsx | 申請フォーム UI |
| ShiftRequestModalFrame | shift-request-modal-frame.tsx | 申請モーダル |
| StatusBadge | status-badge.tsx | ステータス表示 |
| RequestHistoryTimeline | request-history-timeline.tsx | 履歴表示 |
| RequestHistoryToggle | request-history-toggle.tsx | 履歴トグル |

### 共通 UI

| コンポーネント | ファイル | 説明 |
|---------------|---------|------|
| Button | ui/button.tsx | ボタン |
| Card | ui/card.tsx | カード |
| Dialog | ui/dialog.tsx | ダイアログ |
| Input | ui/input.tsx | 入力フィールド |
| Select | ui/select.tsx | 選択フィールド |
| Toast | ui/toast.tsx | トースト通知 |

## UI コンポーネント一覧

### 基本要素

- `button.tsx` - ボタン
- `input.tsx` - テキスト入力
- `textarea.tsx` - 複数行入力
- `label.tsx` - ラベル
- `checkbox.tsx` - チェックボックス
- `radio-group.tsx` - ラジオボタン
- `select.tsx` - セレクトボックス
- `switch.tsx` - スイッチ
- `slider.tsx` - スライダー

### レイアウト

- `card.tsx` - カードコンテナ
- `separator.tsx` - 区切り線
- `scroll-area.tsx` - スクロールエリア
- `resizable.tsx` - リサイズ可能パネル
- `tabs.tsx` - タブ

### フィードバック

- `toast.tsx` - トースト通知
- `toaster.tsx` - トースト管理
- `alert.tsx` - アラート
- `progress.tsx` - プログレスバー
- `skeleton.tsx` - スケルトン
- `spinner.tsx` - スピナー

### オーバーレイ

- `dialog.tsx` - ダイアログ
- `sheet.tsx` - シート
- `drawer.tsx` - ドロワー
- `popover.tsx` - ポップオーバー
- `tooltip.tsx` - ツールチップ
- `dropdown-menu.tsx` - ドロップダウンメニュー

### ナビゲーション

- `navigation-menu.tsx` - ナビゲーションメニュー
- `menubar.tsx` - メニューバー
- `breadcrumb.tsx` - パンくずリスト
- `pagination.tsx` - ページネーション

### データ表示

- `table.tsx` - テーブル
- `badge.tsx` - バッジ
- `avatar.tsx` - アバター
- `chart.tsx` - チャート

### 入力補助

- `calendar.tsx` - カレンダー
- `date-input.tsx` - 日付入力
- `input-otp.tsx` - OTP 入力
- `form.tsx` - フォーム
- `field.tsx` - フォームフィールド

## コンポーネントの使用例

### ボタン

```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">保存</Button>
<Button variant="destructive">削除</Button>
<Button variant="outline">キャンセル</Button>
```

### ダイアログ

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>開く</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>タイトル</DialogTitle>
    </DialogHeader>
    <p>内容</p>
  </DialogContent>
</Dialog>
```

### フォーム

```tsx
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";

const form = useForm();

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>メールアドレス</FormLabel>
          <Input {...field} />
        </FormItem>
      )}
    />
    <Button type="submit">送信</Button>
  </form>
</Form>
```

## 関連ドキュメント

- [技術スタック](../02-architecture/02-tech-stack.md)
- [UI コンポーネント詳細](02-ui-components.md)
- [カスタムコンポーネント](03-custom-components.md)
