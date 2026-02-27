# 状態遷移の詳細

## 概要

申請のステータス遷移について詳細に説明します。

## Fix 申請の状態遷移

### 新規作成

```mermaid
stateDiagram-v2
    [*] --> pending: request_fix()
    
    note right of pending
        status: pending
        decision_type: null
        reviewed_by: null
        reviewed_at: null
    end note
```

### 承認

```mermaid
stateDiagram-v2
    pending --> approved: review_fix_request(decision='approve')
    
    note right of approved
        status: approved
        decision_type: approve
        approved_start_at: = requested_start_at
        approved_end_at: = requested_end_at
        reviewed_by: レビュワーID
        reviewed_at: 現在時刻
    end note
```

### 変更承認

```mermaid
stateDiagram-v2
    pending --> approved: review_fix_request(decision='modify')
    
    note right of approved
        status: approved
        decision_type: modify
        approved_start_at: 変更後の値
        approved_end_at: 変更後の値
        change_reason: 変更理由
        reviewed_by: レビュワーID
        reviewed_at: 現在時刻
    end note
```

### 却下

```mermaid
stateDiagram-v2
    pending --> rejected: review_fix_request(decision='reject')
    
    note right of rejected
        status: rejected
        decision_type: reject
        approved_start_at: null
        approved_end_at: null
        reviewed_by: レビュワーID
        reviewed_at: 現在時刻
    end note
```

### 取り下げ

```mermaid
stateDiagram-v2
    pending --> withdrawn: withdraw_request()
    
    note right of withdrawn
        status: withdrawn
        reviewer_note: 取り下げ理由
    end note
```

### 承認取消

```mermaid
stateDiagram-v2
    approved --> withdrawn: cancel_approved_request()
    
    note right of withdrawn
        status: withdrawn
        decision_type: null (クリア)
        approved_start_at: null (クリア)
        approved_end_at: null (クリア)
        reviewed_by: null (クリア)
        reviewed_at: null (クリア)
        reviewer_note: 取消理由
    end note
```

## Flex 申請の状態遷移

### 新規作成

```mermaid
stateDiagram-v2
    [*] --> pending: request_flex()
    
    note right of pending
        status: pending
        iso_year: 計算値
        iso_week: 計算値
        week_start_date: 計算値
        requested_hours: 入力値
    end note
```

### 承認

```mermaid
stateDiagram-v2
    pending --> approved: review_flex_request(decision='approve')
    
    note right of approved
        status: approved
        decision_type: approve
        approved_hours: = requested_hours
    end note
```

### 変更承認

```mermaid
stateDiagram-v2
    pending --> approved: review_flex_request(decision='modify')
    
    note right of approved
        status: approved
        decision_type: modify
        approved_hours: 変更後の値
    end note
```

## 代理作成

### Fix 代理作成

```mermaid
stateDiagram-v2
    [*] --> approved: proxy_create_fix_request()
    
    note right of approved
        status: approved (即時)
        decision_type: approve
        created_by: 作成者ID
        user_id: スタッフID
    end note
```

### Flex 代理作成

```mermaid
stateDiagram-v2
    [*] --> approved: proxy_create_flex_request()
    
    note right of approved
        status: approved (即時)
        decision_type: approve
        approved_hours: = requested_hours
        created_by: 作成者ID
        user_id: スタッフID
    end note
```

## 承認済み申請の再処理

### 再承認/再変更

```mermaid
stateDiagram-v2
    approved --> approved: review_fix_request()
    
    note right of approved
        既存の承認内容を更新
        履歴に再処理を記録
    end note
```

## データの変化

### pending → approved (approve)

| カラム | 変更前 | 変更後 |
|--------|--------|--------|
| status | pending | approved |
| decision_type | null | approve |
| approved_* | null | = requested_* |
| reviewed_by | null | レビュワーID |
| reviewed_at | null | 現在時刻 |
| reviewer_note | null | メッセージ |

### pending → approved (modify)

| カラム | 変更前 | 変更後 |
|--------|--------|--------|
| status | pending | approved |
| decision_type | null | modify |
| approved_* | null | 変更値 |
| change_reason | null | 変更理由 |
| reviewed_by | null | レビュワーID |
| reviewed_at | null | 現在時刻 |
| reviewer_note | null | メッセージ |

### pending → rejected

| カラム | 変更前 | 変更後 |
|--------|--------|--------|
| status | pending | rejected |
| decision_type | null | reject |
| approved_* | null | null |
| reviewed_by | null | レビュワーID |
| reviewed_at | null | 現在時刻 |
| reviewer_note | null | メッセージ |

### pending → withdrawn

| カラム | 変更前 | 変更後 |
|--------|--------|--------|
| status | pending | withdrawn |
| reviewer_note | null | 取り下げ理由 |

### approved → withdrawn

| カラム | 変更前 | 変更後 |
|--------|--------|--------|
| status | approved | withdrawn |
| decision_type | approve/modify | null |
| approved_* | 値 | null |
| reviewed_by | ID | null |
| reviewed_at | 時刻 | null |
| reviewer_note | 値 | 取消理由 |

## 関連ドキュメント

- [ステータス遷移図](02-status-transitions.md)
- [RPC 関数](../05-api/03-rpc-functions.md)
- [スキーマ設計](../06-database/01-schema.md)
