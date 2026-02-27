# UI コンポーネント詳細

## 概要

notocord の UI コンポーネントは、shadcn/ui をベースにカスタマイズされています。本ドキュメントでは、主要な UI コンポーネントの詳細を説明します。

## Button

### 基本的な使い方

```tsx
import { Button } from "@/components/ui/button";

<Button>デフォルト</Button>
<Button variant="destructive">削除</Button>
<Button variant="outline">アウトライン</Button>
<Button variant="secondary">セカンダリ</Button>
<Button variant="ghost">ゴースト</Button>
<Button variant="link">リンク</Button>
```

### バリアント

| バリアント | 用途 |
|-----------|------|
| default | 主要アクション |
| destructive | 削除・危険な操作 |
| outline | 副次アクション |
| secondary | 代替アクション |
| ghost | 控えめなアクション |
| link | リンクスタイル |

### サイズ

```tsx
<Button size="sm">小</Button>
<Button size="default">通常</Button>
<Button size="lg">大</Button>
<Button size="icon">🔔</Button>
```

### プロパティ

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| variant | string | 見た目のバリアント |
| size | string | サイズ |
| disabled | boolean | 無効状態 |
| asChild | boolean | 子要素としてレンダリング |

## Input

### 基本的な使い方

```tsx
import { Input } from "@/components/ui/input";

<Input type="text" placeholder="入力してください" />
<Input type="email" placeholder="email@example.com" />
<Input type="password" placeholder="パスワード" />
```

### プロパティ

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| type | string | 入力タイプ |
| placeholder | string | プレースホルダー |
| disabled | boolean | 無効状態 |
| value | string | 値 |
| onChange | function | 変更ハンドラ |

## Select

### 基本的な使い方

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<Select>
  <SelectTrigger>
    <SelectValue placeholder="選択してください" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">オプション1</SelectItem>
    <SelectItem value="option2">オプション2</SelectItem>
    <SelectItem value="option3">オプション3</SelectItem>
  </SelectContent>
</Select>
```

### コンポーネント構成

| コンポーネント | 説明 |
|---------------|------|
| Select | ルートコンテナ |
| SelectTrigger | トリガーボタン |
| SelectValue | 選択値の表示 |
| SelectContent | ドロップダウン内容 |
| SelectItem | 選択肢 |

## Dialog

### 基本的な使い方

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>ダイアログを開く</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>確認</DialogTitle>
      <DialogDescription>
        この操作を実行しますか？
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">キャンセル</Button>
      <Button>実行</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### コンポーネント構成

| コンポーネント | 説明 |
|---------------|------|
| Dialog | ルートコンテナ |
| DialogTrigger | トリガー要素 |
| DialogContent | ダイアログ本体 |
| DialogHeader | ヘッダー |
| DialogTitle | タイトル |
| DialogDescription | 説明文 |
| DialogFooter | フッター |

## Card

### 基本的な使い方

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>カードタイトル</CardTitle>
    <CardDescription>カードの説明文</CardDescription>
  </CardHeader>
  <CardContent>
    <p>カードの内容</p>
  </CardContent>
  <CardFooter>
    <Button>アクション</Button>
  </CardFooter>
</Card>
```

## Tabs

### 基本的な使い方

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">タブ1</TabsTrigger>
    <TabsTrigger value="tab2">タブ2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    タブ1の内容
  </TabsContent>
  <TabsContent value="tab2">
    タブ2の内容
  </TabsContent>
</Tabs>
```

## Toast

### 基本的な使い方

```tsx
import { useToast } from "@/hooks/use-toast";

function MyComponent() {
  const { toast } = useToast();
  
  const handleClick = () => {
    toast({
      title: "成功",
      description: "操作が完了しました。",
    });
  };
  
  return <Button onClick={handleClick}>トーストを表示</Button>;
}
```

### トーストタイプ

```tsx
// 成功
toast({
  title: "成功",
  description: "保存しました。",
});

// エラー
toast({
  title: "エラー",
  description: "保存に失敗しました。",
  variant: "destructive",
});
```

## Form

### 基本的な使い方

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

const formSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });
  
  const onSubmit = (data) => {
    console.log(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>メールアドレス</FormLabel>
              <FormControl>
                <Input {...field} />
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

## Calendar

### 基本的な使い方

```tsx
import { Calendar } from "@/components/ui/calendar";

function MyCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border"
    />
  );
}
```

## Badge

### 基本的な使い方

```tsx
import { Badge } from "@/components/ui/badge";

<Badge>デフォルト</Badge>
<Badge variant="secondary">セカンダリ</Badge>
<Badge variant="destructive">エラー</Badge>
<Badge variant="outline">アウトライン</Badge>
```

## 関連ドキュメント

- [コンポーネント概要](01-overview.md)
- [カスタムコンポーネント](03-custom-components.md)
- [技術スタック](../02-architecture/02-tech-stack.md)
