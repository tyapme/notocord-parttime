# フォームコンポーネント

## 概要

notocord のフォームは、React Hook Form と Zod を使用して実装されています。本ドキュメントでは、フォーム関連のコンポーネントとパターンを説明します。

## フォームの基本構成

### 使用ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| react-hook-form | フォーム状態管理 |
| @hookform/resolvers | バリデーションリゾルバ |
| zod | スキーマバリデーション |

### 基本パターン

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// 1. スキーマ定義
const formSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
});

type FormValues = z.infer<typeof formSchema>;

// 2. コンポーネント
function MyForm() {
  // 3. useForm フック
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });
  
  // 4. サブミットハンドラ
  const onSubmit = (data: FormValues) => {
    console.log(data);
  };
  
  // 5. JSX
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名前</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>メールアドレス</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit">送信</Button>
      </form>
    </Form>
  );
}
```

## Fix 申請フォーム

### スキーマ

```typescript
const fixRequestSchema = z.object({
  date: z.date({
    required_error: "日付を選択してください",
  }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "時刻形式が不正です"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "時刻形式が不正です"),
  note: z.string().optional(),
}).refine(
  (data) => {
    const start = parseTime(data.startTime);
    const end = parseTime(data.endTime);
    return end > start;
  },
  {
    message: "終了時刻は開始時刻より後にしてください",
    path: ["endTime"],
  }
).refine(
  (data) => {
    const duration = getDurationHours(data.startTime, data.endTime);
    return duration <= 8;
  },
  {
    message: "勤務時間は8時間以内にしてください",
    path: ["endTime"],
  }
);
```

### フォーム構成

```tsx
<FormField
  control={form.control}
  name="date"
  render={({ field }) => (
    <FormItem>
      <FormLabel>日付</FormLabel>
      <FormControl>
        <Calendar
          mode="single"
          selected={field.value}
          onSelect={field.onChange}
          disabled={(date) => date < today || date > threeMonthsLater}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

<div className="grid grid-cols-2 gap-4">
  <FormField
    control={form.control}
    name="startTime"
    render={({ field }) => (
      <FormItem>
        <FormLabel>開始時刻</FormLabel>
        <FormControl>
          <Input type="time" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
  
  <FormField
    control={form.control}
    name="endTime"
    render={({ field }) => (
      <FormItem>
        <FormLabel>終了時刻</FormLabel>
        <FormControl>
          <Input type="time" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```

## Flex 申請フォーム

### スキーマ

```typescript
const flexRequestSchema = z.object({
  week: z.string().min(1, "対象週を選択してください"),
  hours: z.number()
    .min(1, "1時間以上を入力してください")
    .max(40, "40時間以内にしてください"),
  note: z.string().optional(),
});
```

### フォーム構成

```tsx
<FormField
  control={form.control}
  name="week"
  render={({ field }) => (
    <FormItem>
      <FormLabel>対象週</FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {availableWeeks.map((week) => (
            <SelectItem
              key={week.value}
              value={week.value}
              disabled={week.disabled}
            >
              {week.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>

<FormField
  control={form.control}
  name="hours"
  render={({ field }) => (
    <FormItem>
      <FormLabel>希望時間数</FormLabel>
      <FormControl>
        <Input
          type="number"
          min={1}
          max={40}
          {...field}
          onChange={(e) => field.onChange(Number(e.target.value))}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## ユーザー管理フォーム

### スキーマ

```typescript
const userSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  role: z.enum(["staff", "reviewer", "admin"]),
  requestType: z.enum(["fix", "flex"]),
});
```

### フォーム構成

```tsx
<FormField
  control={form.control}
  name="role"
  render={({ field }) => (
    <FormItem>
      <FormLabel>ロール</FormLabel>
      <FormControl>
        <RadioGroup
          onValueChange={field.onChange}
          value={field.value}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="staff" id="staff" />
            <Label htmlFor="staff">スタッフ</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reviewer" id="reviewer" />
            <Label htmlFor="reviewer">レビュワー</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="admin" id="admin" />
            <Label htmlFor="admin">管理者</Label>
          </div>
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## バリデーションパターン

### クロスフィールドバリデーション

```typescript
const schema = z.object({
  startTime: z.string(),
  endTime: z.string(),
}).refine(
  (data) => data.endTime > data.startTime,
  {
    message: "終了時刻は開始時刻より後にしてください",
    path: ["endTime"], // エラー表示位置
  }
);
```

### 条件付きバリデーション

```typescript
const schema = z.object({
  decisionType: z.enum(["approve", "modify", "reject"]),
  changeReason: z.string().optional(),
}).refine(
  (data) => {
    if (data.decisionType === "modify") {
      return data.changeReason && data.changeReason.length > 0;
    }
    return true;
  },
  {
    message: "変更理由は必須です",
    path: ["changeReason"],
  }
);
```

### カスタムバリデーション

```typescript
const schema = z.object({
  email: z.string().email().refine(
    async (email) => {
      // 重複チェック
      const exists = await checkEmailExists(email);
      return !exists;
    },
    "このメールアドレスは既に使用されています"
  ),
});
```

## エラーハンドリング

### フォームエラーの表示

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>メールアドレス</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* エラーメッセージを自動表示 */}
    </FormItem>
  )}
/>
```

### サーバーエラーの表示

```tsx
const onSubmit = async (data: FormValues) => {
  const result = await submitData(data);
  if (!result.ok) {
    // サーバーエラーをフォームに設定
    form.setError("root", {
      type: "server",
      message: result.error,
    });
  }
};

// エラー表示
{form.formState.errors.root && (
  <Alert variant="destructive">
    {form.formState.errors.root.message}
  </Alert>
)}
```

## フォームの状態管理

### ローディング状態

```tsx
const { formState: { isSubmitting } } = form;

<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "送信中..." : "送信"}
</Button>
```

### ダーティ状態

```tsx
const { formState: { isDirty } } = form;

// 変更があった場合のみ保存ボタンを有効化
<Button type="submit" disabled={!isDirty}>
  保存
</Button>
```

## 関連ドキュメント

- [UI コンポーネント詳細](02-ui-components.md)
- [シフト申請](../03-features/01-staff-requests.md)
- [ユーザー管理](../03-features/03-admin-management.md)
