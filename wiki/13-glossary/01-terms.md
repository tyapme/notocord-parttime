# 用語集

## 概要

notocord で使用される専門用語の定義を説明します。

## A

### Admin（管理者）
システムの最上位権限を持つユーザーロール。ユーザー管理、承認業務、すべての機能にアクセス可能。

### Approved（承認済み）
申請が承認されたステータス。シフトが確定している状態。

### Auth（認証）
ユーザーの身元を確認するプロセス。notocord では OTP（ワンタイムパスワード）を使用。

## C

### Created By（作成者）
申請を作成したユーザー。本人または代理作成したレビュワー/管理者。

## D

### Decision Type（決定タイプ）
承認時の決定内容。approve（承認）、modify（変更承認）、reject（却下）がある。

## F

### Fix（固定シフト）
特定の日時でシフトを申請するタイプ。開始時刻と終了時刻を指定する。

### Flex（フレックスシフト）
週単位で希望時間数を申請するタイプ。具体的な日時は後から調整される。

## H

### History（履歴）
申請に対する操作の記録。作成、編集、承認、取り下げなどが記録される。

## I

### ISO Week（ISO週番号）
ISO 8601 に基づく週番号。月曜日を週の始まりとし、1月4日を含む週を第1週とする。

## M

### Magic Link（マジックリンク）
パスワードなしでログインできるリンク。メールに送信され、クリックするとログインできる。

### Modify（変更承認）
申請内容を調整して承認すること。Fix では時間の変更、Flex では時間数の変更。

## O

### OTP（ワンタイムパスワード）
一度限り有効なパスワード。メールで送信される6桁の認証コード。

## P

### Pending（保留中）
承認待ちの申請ステータス。

### Profile（プロファイル）
ユーザーの基本情報。名前、メール、ロール、申請タイプなど。

### Proxy Creation（代理作成）
レビュワー/管理者がスタッフに代わって申請を作成すること。即時承認される。

## R

### Rejected（却下）
申請が承認されなかったステータス。

### Request（申請）
スタッフが作成するシフト希望。Fix または Flex タイプがある。

### Request Type（申請タイプ）
ユーザーが使用できる申請の種類。fix または flex。

### Reviewer（レビュワー）
シフト申請を承認・管理するユーザーロール。

### RLS（Row Level Security）
PostgreSQL の機能。行レベルでデータアクセスを制御する。

### Role（ロール）
ユーザーの権限レベル。staff、reviewer、admin がある。

### RPC（Remote Procedure Call）
サーバー上の関数を呼び出す仕組み。Supabase で使用。

## S

### Session（セッション）
ログイン状態を維持する仕組み。Cookie で管理される。

### Staff（スタッフ）
一般的なシフト勤務者。シフト申請のみ可能。

### Status（ステータス）
申請の状態。pending、approved、rejected、withdrawn がある。

### Supabase
バックエンドサービス。データベース、認証、API を提供。

## U

### User（ユーザー）
システムを利用する人。スタッフ、レビュワー、管理者のいずれか。

### User ID（ユーザーID）
ユーザーを一意に識別する UUID。

## V

### Vercel
フロントエンドのホスティングサービス。Next.js アプリをデプロイ。

## W

### Week Start Date（週開始日）
Flex 申請の対象週の月曜日の日付。

### Withdrawn（取り下げ）
申請を取り消したステータス。スタッフ自身または管理者が実行。

## Z

### Zustand
React の軽量な状態管理ライブラリ。

## 略語一覧

| 略語 | 正式名称 | 説明 |
|------|---------|------|
| API | Application Programming Interface | アプリケーション間の連携インターフェース |
| CRUD | Create, Read, Update, Delete | 基本的なデータ操作 |
| JWT | JSON Web Token | 認証トークンの形式 |
| OTP | One-Time Password | ワンタイムパスワード |
| PWA | Progressive Web App | ネイティブアプリのように動作するWebアプリ |
| RBAC | Role-Based Access Control | ロールベースアクセス制御 |
| RLS | Row Level Security | 行レベルセキュリティ |
| RPC | Remote Procedure Call | リモートプロシージャコール |
| SSR | Server-Side Rendering | サーバーサイドレンダリング |
| UI | User Interface | ユーザーインターフェース |
| UUID | Universally Unique Identifier | 一意識別子 |

## 関連ドキュメント

- [プロジェクト概要](../00-introduction/01-overview.md)
- [対象ユーザー](../00-introduction/03-target-users.md)
- [技術スタック](../02-architecture/02-tech-stack.md)
