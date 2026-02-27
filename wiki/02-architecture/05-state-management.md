# 状態管理設計

## 概要

notocord では、Zustand を使用したシンプルで効率的な状態管理を実装しています。

## Zustand の選定理由

### 比較

| 特性 | Zustand | Redux | Context |
|------|---------|-------|---------|
| ボイラープレート | 少 | 多 | 少 |
| 学習コスト | 低 | 高 | 低 |
| TypeScript サポート | 優秀 | 良好 | 良好 |
| React 19 対応 | ✅ | ✅ | ✅ |
| バンドルサイズ | 小 | 大 | - |
| DevTools | ✅ | ✅ | - |

### 採用理由
1. 軽量で学習コストが低い
2. TypeScript との相性が良い
3. React 19 に完全対応
4. シンプルな API

## ストア設計

### ストア構造

```typescript
interface AppState {
  // === 認証状態 ===
  currentUser: User | null;
  session: Session | null;
  
  // === データ ===
  users: User[];
  requests: Request[];
  requestHistories: Record<string, RequestHistoryEntry[]>;
  
  // === ローディング状態 ===
  initialized: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  historyLoadingByRequestId: Record<string, boolean>;
  
  // === キャッシュ ===
  lastRequestsFetchedAt: number;
  lastUsersFetchedAt: number;
  
  // === エラー ===
  error: string | null;
  
  // === アクション ===
  init: () => Promise<void>;
  // ... 認証アクション
  // ... データ取得アクション
  // ... データ変更アクション
}
```

### データモデル

```typescript
// ユーザー
interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  requestType: RequestType;
}

// 申請（共用型）
type Request = FixRequest | FlexRequest;

// Fix 申請
interface FixRequest {
  id: string;
  type: "fix";
  userId: string;
  userName?: string;
  requestedStartAt: string;
  requestedEndAt: string;
  status: Status;
  // ...
}

// Flex 申請
interface FlexRequest {
  id: string;
  type: "flex";
  userId: string;
  userName?: string;
  isoYear: number;
  isoWeek: number;
  requestedHours: number;
  status: Status;
  // ...
}
```

## アクションパターン

### 初期化

```typescript
init: async () => {
  if (get().initialized) return;
  set({ initialized: true, authLoading: true });
  
  // セッション確認
  const { data } = await supabase.auth.getSession();
  const session = data.session ?? null;
  set({ session });
  
  if (session) {
    await loadProfileAndData(set, get, session);
  }
  
  set({ authLoading: false });
  
  // 認証状態変更のリスナー設定
  supabase.auth.onAuthStateChange(async (event, newSession) => {
    // ...
  });
}
```

### データ取得（キャッシュ付き）

```typescript
fetchRequests: async ({ force = false } = {}) => {
  if (!get().session) {
    set({ requests: [] });
    return;
  }
  
  // キャッシュ確認
  const state = get();
  const now = Date.now();
  const isFresh = now - state.lastRequestsFetchedAt < REQUESTS_CACHE_TTL_MS;
  
  if (!force && isFresh && state.requests.length > 0) {
    return; // キャッシュ有効
  }
  
  // インフライトリクエストの重複防止
  if (fetchRequestsInFlight) {
    await fetchRequestsInFlight;
    return;
  }
  
  fetchRequestsInFlight = (async () => {
    set({ dataLoading: true });
    const { data, error } = await supabase
      .from("shift_requests")
      .select("*")
      .order("created_at", { ascending: false });
    
    // データ変換、ユーザー名解決
    // ...
    
    set({
      requests: mapped,
      dataLoading: false,
      lastRequestsFetchedAt: Date.now()
    });
  })();
  
  await fetchRequestsInFlight;
  fetchRequestsInFlight = null;
}
```

### データ変更

```typescript
addFixRequest: async ({ startAt, endAt, note }) => {
  const { error } = await supabase.rpc("request_fix", {
    start_at: startAt,
    end_at: endAt,
    note: note ?? null
  });
  
  if (error) {
    set({ error: error.message });
    return false;
  }
  
  await get().fetchRequests({ force: true });
  return true;
}
```

## セレクター

### 使用例

```typescript
// コンポーネントでの使用
function MyComponent() {
  // 個別の状態を購読
  const currentUser = useAppStore((s) => s.currentUser);
  const requests = useAppStore((s) => s.requests);
  const dataLoading = useAppStore((s) => s.dataLoading);
  
  // ...
}
```

### 派生状態

```typescript
// 申請のフィルタリング
const pendingRequests = useMemo(
  () => requests.filter(r => r.status === 'pending'),
  [requests]
);

// 自分の申請
const myRequests = useMemo(
  () => requests.filter(r => r.userId === currentUser?.id),
  [requests, currentUser?.id]
);
```

## キャッシュ戦略

### TTL（Time To Live）

```typescript
const REQUESTS_CACHE_TTL_MS = 15_000;  // 15秒
const USERS_CACHE_TTL_MS = 30_000;     // 30秒
```

### 強制リフレッシュ

データ変更後は必ず強制リフレッシュ：

```typescript
await get().fetchRequests({ force: true });
```

## エラーハンドリング

### エラー状態

```typescript
// エラー設定
set({ error: error.message });

// エラー表示（コンポーネント）
const error = useAppStore((s) => s.error);
if (error) {
  return <ErrorMessage>{error}</ErrorMessage>;
}
```

### エラーのクリア

データ取得成功時に自動クリア：

```typescript
set({
  requests: mapped,
  error: null
});
```

## ベストプラクティス

### 1. 状態の最小化
- 派生状態はコンポーネント側で計算
- 正規化されたデータ構造を使用

### 2. セレクターの最適化
- 必要な状態のみを購読
- 複雑な計算は `useMemo` で

### 3. 非同期処理
- ローディング状態を適切に管理
- エラーハンドリングを忘れない

### 4. 型安全性
- TypeScript の型定義を活用
- 型ガードで安全なデータアクセス

## 関連ドキュメント

- [データフロー](03-data-flow.md)
- [技術スタック](02-tech-stack.md)
- [コンポーネント設計](../04-components/01-overview.md)
