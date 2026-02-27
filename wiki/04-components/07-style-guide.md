# スタイルガイド

## 概要

notocord の UI スタイルガイドについて説明します。

## カラーパレット

### プライマリカラー

| トークン | 用途 |
|---------|------|
| `primary` | 主要アクション、ブランドカラー |
| `primary-foreground` | primary 上のテキスト |

### セカンダリカラー

| トークン | 用途 |
|---------|------|
| `secondary` | 補助的なアクション |
| `secondary-foreground` | secondary 上のテキスト |

### 背景

| トークン | 用途 |
|---------|------|
| `background` | ページ背景 |
| `foreground` | テキスト |
| `card` | カード背景 |
| `card-foreground` | カード内テキスト |

### ステータスカラー

| トークン | 用途 |
|---------|------|
| `destructive` | エラー、削除 |
| `muted` | 無効、非活性 |
| `accent` | 強調 |

### ボーダー

| トークン | 用途 |
|---------|------|
| `border` | ボーダー |
| `input` | 入力フィールドのボーダー |
| `ring` | フォーカスリング |

## タイポグラフィ

### フォントファミリー

```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
```

### フォントサイズ

| クラス | サイズ | 用途 |
|--------|--------|------|
| `text-xs` | 12px | 補足情報 |
| `text-sm` | 14px | 本文 |
| `text-base` | 16px | 標準 |
| `text-lg` | 18px | 見出し |
| `text-xl` | 20px | サブタイトル |
| `text-2xl` | 24px | タイトル |

### フォントウェイト

| クラス | 重さ | 用途 |
|--------|------|------|
| `font-normal` | 400 | 本文 |
| `font-medium` | 500 | 強調 |
| `font-semibold` | 600 | 見出し |
| `font-bold` | 700 | タイトル |

## スペーシング

### マージン・パディング

| クラス | サイズ |
|--------|--------|
| `p-1`, `m-1` | 4px |
| `p-2`, `m-2` | 8px |
| `p-3`, `m-3` | 12px |
| `p-4`, `m-4` | 16px |
| `p-6`, `m-6` | 24px |
| `p-8`, `m-8` | 32px |

### ギャップ

| クラス | サイズ |
|--------|--------|
| `gap-1` | 4px |
| `gap-2` | 8px |
| `gap-4` | 16px |
| `gap-6` | 24px |

## ボーダー

### ボーダー半径

| クラス | 半径 |
|--------|------|
| `rounded-sm` | 2px |
| `rounded` | 4px |
| `rounded-md` | 6px |
| `rounded-lg` | 8px |
| `rounded-xl` | 12px |
| `rounded-full` | 9999px |

### ボーダー幅

| クラス | 幅 |
|--------|-----|
| `border` | 1px |
| `border-2` | 2px |

## シャドウ

| クラス | 用途 |
|--------|------|
| `shadow-sm` | 微かな影 |
| `shadow` | 通常の影 |
| `shadow-md` | 中程度の影 |
| `shadow-lg` | 強い影 |

## コンポーネントスタイル

### ボタン

```tsx
// プライマリ
<Button variant="default">保存</Button>

// 削除系
<Button variant="destructive">削除</Button>

// アウトライン
<Button variant="outline">キャンセル</Button>

// ゴースト
<Button variant="ghost">詳細</Button>
```

### カード

```tsx
<Card className="p-4 rounded-lg shadow-sm">
  <CardHeader>
    <CardTitle className="text-lg font-semibold">タイトル</CardTitle>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>
```

### 入力フィールド

```tsx
<Input
  className="h-10 px-3 py-2 rounded-md border border-input bg-background"
  placeholder="入力してください"
/>
```

### バッジ

```tsx
// ステータスバッジ
<Badge variant="default">確定</Badge>
<Badge variant="secondary">保留中</Badge>
<Badge variant="destructive">却下</Badge>
<Badge variant="outline">取り下げ</Badge>
```

## レイアウトパターン

### コンテナ

```tsx
<div className="container mx-auto px-4 py-6">
  {/* コンテンツ */}
</div>
```

### カードリスト

```tsx
<div className="space-y-4">
  {items.map(item => (
    <Card key={item.id} className="p-4">
      {/* カード内容 */}
    </Card>
  ))}
</div>
```

### グリッド

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <Card key={item.id}>
      {/* カード内容 */}
    </Card>
  ))}
</div>
```

### フレックス

```tsx
<div className="flex items-center justify-between">
  <div>左側</div>
  <div>右側</div>
</div>
```

## アニメーション

### トランジション

```tsx
<div className="transition-all duration-200 ease-in-out">
  {/* コンテンツ */}
</div>
```

### ホバー効果

```tsx
<Card className="hover:shadow-md transition-shadow">
  {/* コンテンツ */}
</Card>
```

## アクセシビリティ

### フォーカス

```tsx
<Button className="focus:ring-2 focus:ring-primary focus:ring-offset-2">
  ボタン
</Button>
```

### スクリーンリーダー

```tsx
<span className="sr-only">スクリーンリーダー用テキスト</span>
```

## 関連ドキュメント

- [UI コンポーネント詳細](../04-components/02-ui-components.md)
- [コーディング規約](../08-development/02-coding-standards.md)
- [技術スタック](../02-architecture/02-tech-stack.md)
