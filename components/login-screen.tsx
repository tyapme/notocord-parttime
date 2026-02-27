"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function LoginScreen() {
  const sendSignInCode = useAppStore((s) => s.sendSignInCode);
  const verifySignInCode = useAppStore((s) => s.verifySignInCode);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSendCode = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }

    setLoading(true);
    sendSignInCode(email.trim())
      .then((res) => {
        if (!res.ok) {
          setError(res.error || "認証コードの発行に失敗しました");
        } else {
          setCode("");
          setSent(true);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!code.trim()) {
      setError("認証コードを入力してください");
      return;
    }

    setVerifying(true);
    verifySignInCode({ email: email.trim(), code })
      .then((res) => {
        if (!res.ok) {
          setError(res.error || "サインインに失敗しました");
        }
      })
      .finally(() => setVerifying(false));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="surface-card-subtle w-full max-w-sm px-6 py-7">

        {/* Brand */}
        <div className="mb-8">
          <p className="text-lg font-semibold tracking-tight text-foreground">notocord</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">ログイン</h1>
        </div>

        <form onSubmit={handleVerify} className="space-y-4" noValidate>
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
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
                setSent(false);
              }}
              placeholder="user@example.com"
              className={cn("input-base", error && "border-[var(--status-rejected)]")}
              style={{ fontSize: "16px" }}
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleSendCode}
            className={cn(
              "button-secondary w-full mt-1",
              loading ? "bg-muted text-muted-foreground cursor-not-allowed" : ""
            )}
          >
            {loading ? "送信中..." : "認証コードを送信"}
          </button>

          {sent && (
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3.5 py-3">
              <p className="text-xs font-medium text-[var(--status-approved)]">
                メールに認証コードを送信しました。受信したコードを入力してください。
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="code">
              認証コード
            </label>
            <input
              id="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => {
                setCode(normalizeCodeInput(e.target.value));
                setError("");
              }}
              placeholder="123456"
              className={cn("input-base tracking-[0.16em]", error && "border-[var(--status-rejected)]")}
              style={{ fontSize: "16px" }}
            />
            <p className="text-[11px] text-[var(--on-surface-variant)]">メールで受信した6桁コードを入力してください</p>
          </div>

          {error && (
            <p className="text-xs font-medium text-[var(--status-rejected)]" role="alert">{error}</p>
          )}
          <button
            type="submit"
            disabled={verifying}
            className={cn(
              "button-primary w-full mt-2",
              verifying
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : ""
            )}
          >
            {verifying ? "サインイン中..." : "コードでサインイン"}
          </button>
        </form>

      </div>
    </div>
  );
}
