# データフロー

## 概要

notocord のデータフローは、クライアント側の状態管理（Zustand）とバックエンド（Supabase）の連携によって実現されています。

## 状態管理アーキテクチャ

### Zustand ストア構造

```typescript
interface AppState {
  // 認証
  currentUser: User | null;
  session: Session | null;
  
  // データ
  users: User[];
  requests: Request[];
  requestHistories: Record<string, RequestHistoryEntry[]>;
  
  // ローディング状態
  initialized: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  
  // キャッシュ管理
  lastRequestsFetchedAt: number;
  lastUsersFetchedAt: number;
  
  // エラー
  error: string | null;
  
  // アクション
  init: () => Promise<void>;
  // ... その他のアクション
}
```

## 認証フロー

### ログインシーケンス

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as LoginScreen
    participant S as Store
    participant API as /api/auth/send-code
    participant SA as Supabase Auth

    U->>UI: メール入力
    UI->>S: sendSignInCode(email)
    S->>API: POST { email }
    API->>SA: signInWithOtp()
    SA-->>API: 結果
    API-->>S: { ok, bootstrap? }
    S-->>UI: 結果
    UI-->>U: コード入力画面
    
    U->>UI: コード入力
    UI->>S: verifySignInCode({ email, code })
    S->>SA: verifyOtp()
    SA-->>S: セッション
    S->>S: loadProfileAndData()
    S-->>UI: ログイン完了
    UI-->>U: ホーム画面へ遷移
```

## データ取得フロー

### 申請一覧の取得

```mermaid
sequenceDiagram
    participant C as Component
    participant S as Store
    participant SB as Supabase

    C->>S: fetchRequests()
    S->>S: キャッシュ確認
    
    alt キャッシュ有効
        S-->>C: キャッシュデータ返却
    else キャッシュ無効
        S->>SB: from('shift_requests').select()
        SB-->>S: データ
        S->>S: ユーザー名解決
        S->>S: キャッシュ更新
        S-->>C: 状態更新
    end
```

### キャッシュ戦略

| データ種別 | TTL | 説明 |
|-----------|-----|------|
| 申請一覧 | 15秒 | 頻繁な更新を反映 |
| ユーザー一覧 | 30秒 | 比較的安定したデータ |

## データ変更フロー

### 申請作成

```mermaid
sequenceDiagram
    participant C as Component
    participant S as Store
    participant SB as Supabase
    participant DB as PostgreSQL

    C->>S: addFixRequest({ startAt, endAt, note })
    S->>SB: rpc('request_fix', params)
    SB->>DB: security definer 関数実行
    
    Note over DB: バリデーション
    Note over DB: INSERT shift_requests
    Note over DB: INSERT shift_request_histories
    
    DB-->>SB: 結果
    SB-->>S: 結果
    
    alt 成功
        S->>S: fetchRequests({ force: true })
        S-->>C: true
    else 失敗
        S->>S: set({ error })
        S-->>C: false
    end
```

### 承認処理

```mermaid
sequenceDiagram
    participant R as Reviewer
    participant S as Store
    participant SB as Supabase
    participant DB as PostgreSQL

    R->>S: reviewFixRequest(id, payload)
    S->>SB: rpc('review_fix_request', params)
    SB->>DB: security definer 関数実行
    
    Note over DB: 権限確認
    Note over DB: バリデーション
    Note over DB: UPDATE shift_requests
    Note over DB: INSERT shift_request_histories
    
    DB-->>SB: 結果
    SB-->>S: 結果
    S->>S: fetchRequests({ force: true })
    S-->>R: 結果
```

## リアルタイム更新

現在のバージョンでは、リアルタイム更新（Supabase Realtime）は使用していません。

### 更新トリガー
- ユーザーアクション後の強制リフレッシュ
- 画面遷移時のキャッシュ確認
- プルトゥリフレッシュ（モバイル）

## データ同期パターン

### Optimistic Update（楽観的更新）
現在は使用していません。すべての操作はサーバー確認後に UI を更新。

### Pessimistic Update（悲観的更新）
現在の実装パターン：
1. ユーザーアクション
2. ローディング表示
3. サーバー処理
4. 結果に基づく UI 更新

## エラーハンドリング

### エラーフロー

```mermaid
flowchart TD
    A[操作] --> B{RPC 呼び出し}
    B -->|成功| C[データ更新]
    B -->|失敗| D[エラー設定]
    D --> E[UI にエラー表示]
    C --> F[UI 更新]
```

### エラーの種類

| エラー | 原因 | 対応 |
|--------|------|------|
| 認証エラー | セッション切れ | 再ログイン |
| バリデーションエラー | 入力値不正 | エラーメッセージ表示 |
| 権限エラー | 権限不足 | 操作不可表示 |
| ネットワークエラー | 接続問題 | リトライ案内 |

## パフォーマンス考慮

### データ量の制限
- 申請一覧: 全件取得（ページングなし）
- 履歴: 申請単位で遅延読み込み

### 最適化ポイント
- ユーザー名のバッチ解決
- キャッシュによる重複リクエスト防止
- インフライトリクエストの管理

## 関連ドキュメント

- [システム構成](01-system-overview.md)
- [RPC 関数](../05-api/03-rpc-functions.md)
- [スキーマ設計](../06-database/01-schema.md)
