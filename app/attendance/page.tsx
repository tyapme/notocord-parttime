"use client";

function AttendanceScreen() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="page-title">勤怠</h1>
        <p className="page-subtitle">勤怠機能は次フェーズで実装予定です</p>
      </div>

      <div className="surface-card px-5 py-5 sm:px-6">
        <p className="text-sm text-muted-foreground">
          仕様を受け取り次第、この画面に打刻・勤務実績・集計UIを追加します。
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return <AttendanceScreen />;
}
