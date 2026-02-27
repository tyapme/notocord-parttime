# 警告ロジック

## 概要

notocord では、運用上注意が必要な操作に対して警告を表示します。

## 直近シフトの警告

### 対象操作

- スタッフによる申請取り下げ
- レビュワー/管理者による承認取消

### 判定ロジック

```typescript
// lib/request-urgency.ts
import { differenceInDays, parseISO } from "date-fns";

export function isNearTermShiftRequest(
  request: Request,
  thresholdDays: number = 2
): boolean {
  if (request.type === "fix") {
    const startDate = parseISO(request.requestedStartAt);
    const daysUntil = differenceInDays(startDate, new Date());
    return daysUntil <= thresholdDays;
  }
  
  if (request.type === "flex") {
    const weekStart = parseISO(request.weekStartDate);
    const daysUntil = differenceInDays(weekStart, new Date());
    return daysUntil <= thresholdDays;
  }
  
  return false;
}
```

### 警告表示

```tsx
{isNearTermShiftRequest(request, 2) && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      直近のシフトです。連絡を取ることを推奨します。
    </AlertDescription>
  </Alert>
)}
```

### しきい値

| シフト日まで | 警告 |
|-------------|:----:|
| 2日以内 | ✅ |
| 3日以上 | - |

## Fix 変更承認のはみ出し警告

### 対象操作

- Fix 申請の変更承認

### 判定ロジック

```typescript
function isOutOfRange(
  request: FixRequest,
  approvedStart: string,
  approvedEnd: string
): boolean {
  const reqStart = parseTime(request.requestedStartAt);
  const reqEnd = parseTime(request.requestedEndAt);
  const appStart = parseTime(approvedStart);
  const appEnd = parseTime(approvedEnd);
  
  // 申請時間帯の外への変更
  return appStart < reqStart || appEnd > reqEnd;
}
```

### 条件

| パターン | 警告 |
|---------|:----:|
| 承認開始 < 申請開始 | ✅ |
| 承認終了 > 申請終了 | ✅ |
| 範囲内 | - |

### 例

```
申請: 12:00 - 13:00

承認: 12:00 - 12:30 → 警告なし（範囲内）
承認: 11:30 - 12:30 → 警告あり（開始がはみ出し）
承認: 12:00 - 13:30 → 警告あり（終了がはみ出し）
```

### 警告表示

```tsx
{isOutOfRange(request, approvedStart, approvedEnd) && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      申請時間外への変更です。連絡を取ることを推奨します。
    </AlertDescription>
  </Alert>
)}
```

## Flex 時間数増加の警告

### 対象操作

- Flex 申請の変更承認

### 判定ロジック

```typescript
function isHoursIncreased(
  requestedHours: number,
  approvedHours: number
): boolean {
  return approvedHours > requestedHours;
}
```

### 条件

| パターン | 警告 |
|---------|:----:|
| 承認 > 申請 | ✅ |
| 承認 ≤ 申請 | - |

### 例

```
申請: 20時間

承認: 15時間 → 警告なし（減少）
承認: 20時間 → 警告なし（同じ）
承認: 25時間 → 警告あり（増加）
```

### 警告表示

```tsx
{isHoursIncreased(request.requestedHours, approvedHours) && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      希望より多い時間数です。連絡を取ることを推奨します。
    </AlertDescription>
  </Alert>
)}
```

## 警告の共通仕様

### 表示タイミング

- 操作確定前（プレビュー段階）
- 入力値の変更時にリアルタイム更新

### 処理への影響

- 警告は情報提供のみ
- 処理自体はブロックしない
- 連絡を推奨するのみ

### UI デザイン

```tsx
<Alert variant="warning" className="my-4">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>注意</AlertTitle>
  <AlertDescription>
    {warningMessage}
  </AlertDescription>
</Alert>
```

### 色

| 要素 | 色 |
|------|-----|
| 背景 | 黄色（warning） |
| アイコン | オレンジ |
| テキスト | ダークグレー |

## NearTermContactWarning コンポーネント

```tsx
// components/near-term-contact-warning.tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface NearTermContactWarningProps {
  className?: string;
}

export function NearTermContactWarning({
  className,
}: NearTermContactWarningProps) {
  return (
    <Alert variant="warning" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>直近のシフト</AlertTitle>
      <AlertDescription>
        直近のシフトです。連絡を取ることを推奨します。
      </AlertDescription>
    </Alert>
  );
}
```

## 関連ドキュメント

- [シフト申請](../03-features/01-staff-requests.md)
- [シフト承認](../03-features/02-reviewer-approval.md)
- [カスタムコンポーネント](../04-components/03-custom-components.md)
