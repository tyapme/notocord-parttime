"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

function HomeScreen() {
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const shiftPath = currentUser?.role === "staff" ? "/shift/my" : "/shift/review";

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="page-title">ホーム</h1>
        <p className="page-subtitle">勤務申請システムのトップページです</p>
      </div>

      <div className="surface-card px-5 py-5 sm:px-6">
        <p className="text-sm text-muted-foreground">
          シフト申請・承認は「シフト」メニューから操作できます。
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => router.push(shiftPath, { scroll: false })}
            className="button-primary px-4 text-sm"
          >
            シフトへ移動
          </button>
          <button
            type="button"
            onClick={() => router.push("/attendance", { scroll: false })}
            className="button-secondary px-4 text-sm"
          >
            勤怠を見る
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <HomeScreen />;
}
