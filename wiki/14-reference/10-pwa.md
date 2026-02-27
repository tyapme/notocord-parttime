# PWA 対応

## 概要

notocord は Progressive Web App (PWA) として動作します。

## PWA の特徴

### インストール可能

- ホーム画面に追加可能
- ネイティブアプリのような外観

### オフライン対応

- Service Worker による基本的なキャッシュ
- ネットワーク接続が必要な機能は制限あり

### レスポンシブ

- モバイル/タブレット/デスクトップ対応
- 画面サイズに応じた最適化

## マニフェスト

### public/manifest.json

```json
{
  "name": "notocord",
  "short_name": "notocord",
  "description": "シフト管理システム",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### メタデータ

```tsx
// app/layout.tsx
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
```

## ホーム画面への追加

### iOS Safari

1. Safari でアプリを開く
2. 共有ボタンをタップ
3. 「ホーム画面に追加」を選択
4. 「追加」をタップ

### Android Chrome

1. Chrome でアプリを開く
2. メニューをタップ
3. 「ホーム画面に追加」を選択
4. 「追加」をタップ

### デスクトップ Chrome

1. Chrome でアプリを開く
2. アドレスバーの「インストール」アイコンをクリック
3. 「インストール」をクリック

## スプラッシュスクリーン

### iOS

```html
<link rel="apple-touch-startup-image" href="/splash.png" />
```

### 動作

- アプリ起動時に表示
- アプリの読み込み完了まで表示

## アイコン

### 必要なサイズ

| サイズ | 用途 |
|--------|------|
| 192x192 | Android |
| 512x512 | Android |
| 180x180 | iOS |
| 167x167 | iPad Pro |
| 152x152 | iPad |

### Apple タッチアイコン

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## オフライン対応

### 現在の状況

- 基本的なページキャッシュ
- 認証にはネットワーク必要
- データ操作にはネットワーク必要

### 将来の改善

- より積極的なキャッシュ戦略
- オフラインでの閲覧機能
- バックグラウンド同期

## テスト

### Lighthouse

```bash
# Chrome DevTools で実行
# Lighthouse → PWA
```

### チェック項目

- [ ] マニフェストが有効
- [ ] アイコンが設定
- [ ] インストール可能
- [ ] HTTPS
- [ ] Service Worker

## 制限事項

### iOS Safari

- プッシュ通知は限定的サポート
- バックグラウンド実行に制限

### セキュリティ

- HTTPS 必須
- Same-origin ポリシー

## 関連ドキュメント

- [システム要件](../00-introduction/04-system-requirements.md)
- [Vercel デプロイ](../09-deployment/02-vercel.md)
- [技術スタック](../02-architecture/02-tech-stack.md)
