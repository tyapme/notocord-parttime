"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { LoginScreen } from "@/components/login-screen";

function defaultPath(): string {
  return "/home";
}

export default function Page() {
  const currentUser = useAppStore((s) => s.currentUser);
  const init = useAppStore((s) => s.init);
  const authLoading = useAppStore((s) => s.authLoading);
  const router = useRouter();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!currentUser) return;
    router.replace(defaultPath());
  }, [currentUser?.id, currentUser?.role, router]);

  if (authLoading && !currentUser) {
    return <div className="min-h-screen bg-[var(--surface)]" />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="surface-card-subtle px-4 py-3 text-sm text-muted-foreground">リダイレクト中...</p>
    </div>
  );
}
