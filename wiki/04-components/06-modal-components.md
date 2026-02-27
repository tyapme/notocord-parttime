# モーダルコンポーネント

## 概要

notocord で使用されるモーダルコンポーネントについて説明します。

## Dialog (Radix UI)

基本的なモーダルダイアログ。

### 構成

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      <DialogDescription>説明文</DialogDescription>
    </DialogHeader>
    
    {/* コンテンツ */}
    
    <DialogFooter>
      <Button variant="outline">キャンセル</Button>
      <Button>確定</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### プロパティ

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| open | boolean | 開閉状態（制御モード） |
| onOpenChange | function | 状態変更ハンドラ |
| defaultOpen | boolean | 初期状態（非制御モード） |

## Alert Dialog

確認が必要な操作に使用。

### 構成

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">削除</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
      <AlertDialogDescription>
        この操作は取り消せません。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>キャンセル</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Sheet

サイドから出てくるパネル。

### 構成

```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

<Sheet>
  <SheetTrigger asChild>
    <Button>メニュー</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>メニュー</SheetTitle>
      <SheetDescription>設定とオプション</SheetDescription>
    </SheetHeader>
    
    {/* コンテンツ */}
  </SheetContent>
</Sheet>
```

### side オプション

| 値 | 位置 |
|-----|------|
| top | 上から |
| bottom | 下から |
| left | 左から |
| right | 右から |

## Drawer

モバイル向けのボトムシート。

### 構成

```tsx
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

<Drawer>
  <DrawerTrigger asChild>
    <Button>詳細</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>詳細情報</DrawerTitle>
      <DrawerDescription>追加情報を表示</DrawerDescription>
    </DrawerHeader>
    
    {/* コンテンツ */}
    
    <DrawerFooter>
      <Button>閉じる</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

## ShiftRequestModalFrame

申請詳細モーダル。

### 構成

```tsx
interface ShiftRequestModalFrameProps {
  request: Request;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onWithdraw?: () => void;
}

function ShiftRequestModalFrame({
  request,
  open,
  onOpenChange,
  onEdit,
  onWithdraw,
}: ShiftRequestModalFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>申請詳細</DialogTitle>
        </DialogHeader>
        
        {/* 申請内容 */}
        <RequestDetails request={request} />
        
        {/* 履歴 */}
        <RequestHistoryToggle requestId={request.id} />
        
        <DialogFooter>
          {request.status === "pending" && (
            <>
              <Button variant="outline" onClick={onWithdraw}>
                取り下げ
              </Button>
              <Button onClick={onEdit}>編集</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## ReviewRequestModal

承認モーダル。

### 構成

```tsx
interface ReviewRequestModalProps {
  request: Request;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (decision: Decision) => Promise<void>;
}

function ReviewRequestModal({
  request,
  open,
  onOpenChange,
  onReview,
}: ReviewRequestModalProps) {
  const [decision, setDecision] = useState<DecisionType>("approve");
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>申請処理</DialogTitle>
        </DialogHeader>
        
        {/* 申請内容 */}
        <RequestDetails request={request} />
        
        {/* 決定選択 */}
        <RadioGroup value={decision} onValueChange={setDecision}>
          <RadioGroupItem value="approve">承認</RadioGroupItem>
          <RadioGroupItem value="modify">変更承認</RadioGroupItem>
          <RadioGroupItem value="reject">却下</RadioGroupItem>
        </RadioGroup>
        
        {/* 変更フォーム */}
        {decision === "modify" && (
          <ModifyForm request={request} />
        )}
        
        {/* メッセージ */}
        <Textarea
          placeholder="メッセージ（任意）"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit}>確定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## モーダルのベストプラクティス

### 1. 適切なサイズ

```tsx
<DialogContent className="max-w-md">
  {/* コンテンツ */}
</DialogContent>
```

### 2. フォーカス管理

Radix UI が自動的にフォーカスを管理します。

### 3. キーボード操作

- `Esc`: モーダルを閉じる
- `Tab`: フォーカス移動

### 4. アクセシビリティ

```tsx
<DialogTitle>タイトル</DialogTitle>
<DialogDescription>説明</DialogDescription>
```

## 関連ドキュメント

- [UI コンポーネント詳細](02-ui-components.md)
- [カスタムコンポーネント](03-custom-components.md)
- [フォームコンポーネント](04-form-components.md)
