"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppNav, Tab } from "./app-nav";
import { LoginScreen } from "./login-screen";

const PATH_BY_TAB: Record<Tab, string> = {
  home: "/home",
  attendance: "/attendance",
  shifts: "/shift",
  my: "/shift/my",
  new: "/shift/new",
  review: "/shift/review",
  proxy: "/shift/proxy",
  users: "/users",
  admin: "/admin",
};

function defaultTab(): Tab {
  return "home";
}

function isAllowed(role: string, tab: Tab): boolean {
  if (role === "staff") return tab === "home" || tab === "attendance" || tab === "shifts" || tab === "my" || tab === "new";
  if (role === "reviewer") return tab === "home" || tab === "attendance" || tab === "shifts" || tab === "review" || tab === "proxy" || tab === "users";
  return tab === "home" || tab === "attendance" || tab === "shifts" || tab === "review" || tab === "proxy" || tab === "users" || tab === "admin";
}

export function AppShell({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  const currentUser = useAppStore((s) => s.currentUser);
  const init = useAppStore((s) => s.init);
  const authLoading = useAppStore((s) => s.authLoading);
  const router = useRouter();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isAllowed(currentUser.role, tab)) {
      const next = PATH_BY_TAB[defaultTab()];
      router.replace(next);
    }
  }, [currentUser?.id, currentUser?.role, tab, router]);

  if (authLoading && !currentUser) {
    return <div className="min-h-screen bg-[var(--surface)]" />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  if (!isAllowed(currentUser.role, tab)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="surface-card-subtle px-4 py-3 text-sm text-muted-foreground">リダイレクト中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav
        activeTab={tab}
        onTabChange={(t) => router.push(PATH_BY_TAB[t])}
      />
      <main className="app-shell-main">
        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  );
}
