# 変更履歴機能

## 概要

notocord では、すべての申請に対する操作履歴を記録しています。これにより、誰が・いつ・何を行ったかを追跡できます。

## 履歴の確認方法

### 申請詳細から確認

1. 申請一覧から申請をタップ
2. 詳細画面で「変更履歴を見る」をタップ
3. 履歴タイムラインが展開

### 表示例

```
┌─────────────────────────────┐
│ 申請詳細                     │
├─────────────────────────────┤
│ ...（申請内容）...            │
│                             │
│ ▼ 変更履歴を見る            │
│ ┌─────────────────────────┐ │
│ │ 2026/02/25 14:00        │ │
│ │ 承認 by 管理者A          │ │
│ │ → 確定（承認）            │ │
│ │ メッセージ: よろしくお願いします │ │
│ ├─────────────────────────┤ │
│ │ 2026/02/25 10:30        │ │
│ │ 編集 by 田中太郎          │ │
│ │ 09:00-17:00 → 10:00-18:00 │ │
│ ├─────────────────────────┤ │
│ │ 2026/02/25 10:00        │ │
│ │ 作成 by 田中太郎          │ │
│ │ → 保留中                 │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

## アクションタイプ

### create（作成）

スタッフによる申請の新規作成。

| 項目 | 値 |
|------|-----|
| action | create |
| from_status | null |
| to_status | pending |
| actor_id | スタッフのID |

### proxy_create（代理作成）

レビュワー/管理者による代理申請の作成。

| 項目 | 値 |
|------|-----|
| action | proxy_create |
| from_status | null |
| to_status | approved |
| actor_id | 作成者のID |

### update（編集）

スタッフによる申請内容の編集。

| 項目 | 値 |
|------|-----|
| action | update |
| from_status | pending |
| to_status | pending |
| actor_id | スタッフのID |
| details | 変更前後の値 |

### review（承認/却下）

レビュワー/管理者による承認処理。

| 項目 | 値 |
|------|-----|
| action | review |
| from_status | pending or approved |
| to_status | approved or rejected |
| from_decision_type | 変更前の決定タイプ |
| to_decision_type | 変更後の決定タイプ |
| actor_id | 承認者のID |

### withdraw（取り下げ）

スタッフによる申請の取り下げ。

| 項目 | 値 |
|------|-----|
| action | withdraw |
| from_status | pending |
| to_status | withdrawn |
| actor_id | スタッフのID |
| details | 取り下げ理由 |

### reopen（再申請）

却下/取り下げ後の再申請（将来対応予定）。

## 履歴データ構造

### RequestHistoryEntry

```typescript
interface RequestHistoryEntry {
  id: string;
  requestId: string;
  action: "create" | "proxy_create" | "update" | "withdraw" | "review" | "reopen";
  actorId: string | null;
  actorName?: string;
  fromStatus?: Status | null;
  toStatus?: Status | null;
  fromDecisionType?: DecisionType | null;
  toDecisionType?: DecisionType | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
```

### details の内容例

#### 編集時
```json
{
  "before": {
    "requested_start_at": "2026-03-01T09:00:00",
    "requested_end_at": "2026-03-01T17:00:00"
  },
  "after": {
    "requested_start_at": "2026-03-01T10:00:00",
    "requested_end_at": "2026-03-01T18:00:00"
  }
}
```

#### 承認時
```json
{
  "decision_type": "modify",
  "approved_start_at": "2026-03-01T10:00:00",
  "approved_end_at": "2026-03-01T17:00:00",
  "change_reason": "シフト調整のため",
  "reviewer_note": "よろしくお願いします"
}
```

#### 取り下げ時
```json
{
  "reason": "予定が変わったため"
}
```

## タイムライン表示

### 表示順序

- 新しい履歴が上に表示
- 時系列の降順

### 表示情報

各履歴エントリーには以下が表示されます：

1. **日時**: 操作が行われた日時
2. **アクション**: 操作の種類（日本語表示）
3. **実行者**: 操作を行った人の名前
4. **状態遷移**: ステータスの変化
5. **詳細情報**: 変更内容、理由、メッセージなど

### アクションの日本語表示

| action | 表示 |
|--------|------|
| create | 作成 |
| proxy_create | 代理作成 |
| update | 編集 |
| review | 承認/却下 |
| withdraw | 取り下げ |
| reopen | 再申請 |

## データベース

### shift_request_histories テーブル

```sql
CREATE TABLE shift_request_histories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES shift_requests(id),
  actor_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  from_status text,
  to_status text,
  from_decision_type text,
  to_decision_type text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS ポリシー

- staff: 自分の申請の履歴のみ参照可能
- reviewer/admin: 全件参照可能

## パフォーマンス考慮

### 遅延読み込み

履歴は申請詳細を開いたときに個別に取得：

```typescript
await store.fetchRequestHistory(requestId);
```

### ローディング状態

```typescript
historyLoadingByRequestId: Record<string, boolean>
```

## 活用例

### 監査

- 誰が何を行ったかの追跡
- 不正操作の検知

### 問い合わせ対応

- 申請の経緯確認
- ステータス変更の確認

### 業務改善

- 処理時間の分析
- ボトルネックの特定

## 関連ドキュメント

- [シフト申請（スタッフ向け）](01-staff-requests.md)
- [シフト承認（レビュワー向け）](02-reviewer-approval.md)
- [スキーマ設計](../06-database/01-schema.md)
