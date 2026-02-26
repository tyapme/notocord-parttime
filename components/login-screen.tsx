"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export function LoginScreen() {
  const sendMagicLink = useAppStore((s) => s.sendMagicLink);

  const [email, setEmail]       = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    if (!email.trim()) { setError("メールアドレスを入力してください"); return; }

    setLoading(true);
    sendMagicLink(email.trim())
      .then((res) => {
        if (!res.ok) {
          setError(res.error || "送信に失敗しました");
        } else {
          setSent(true);
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="surface-card-subtle w-full max-w-sm px-6 py-7">

        {/* Brand */}
        <div className="mb-8">
          <div className="h-10 w-10 rounded-[var(--ds-radius-md)] bg-primary flex items-center justify-center mb-5">
            <svg className="h-5 w-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ログイン</h1>
          <p className="mt-1 text-sm text-muted-foreground">勤務申請システム</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="user@example.com"
            className={cn("input-base", error && "border-[var(--status-rejected)]")}
          />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs font-medium text-[var(--status-rejected)]" role="alert">{error}</p>
          )}
          {sent && !error && (
            <p className="text-xs font-medium text-[var(--status-approved)]">
              マジックリンクを送信しました。メールをご確認ください。
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "button-primary w-full mt-2",
              loading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : ""
            )}
          >
            {loading ? "送信中..." : "マジックリンクを送信"}
          </button>
        </form>

      </div>
    </div>
  );
}
