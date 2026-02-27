"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

function normalizeCodeInput(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function LoginScreen() {
  const sendSignInCode = useAppStore((s) => s.sendSignInCode);
  const verifySignInCode = useAppStore((s) => s.verifySignInCode);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
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
        if (!res.ok || !res.challenge || !res.code) {
          setError(res.error || "認証コードの発行に失敗しました");
        } else {
          setChallenge(res.challenge);
          setIssuedCode(res.code);
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
    if (!challenge) {
      setError("先に認証コードを発行してください");
      return;
    }
    if (code.replace("-", "").length !== 8) {
      setError("認証コードを入力してください");
      return;
    }

    setVerifying(true);
    verifySignInCode({ email: email.trim(), code, challenge })
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
                setChallenge("");
                setSent(false);
                setIssuedCode("");
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
            {loading ? "発行中..." : "認証コードを発行"}
          </button>

          {sent && (
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3.5 py-3">
              <p className="text-[11px] text-[var(--on-surface-variant)]">認証コード</p>
              <p className="mt-1 text-lg font-semibold tracking-[0.08em] text-foreground">{issuedCode}</p>
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
              inputMode="text"
              value={code}
              onChange={(e) => {
                setCode(normalizeCodeInput(e.target.value));
                setError("");
              }}
              placeholder="AAAA-2222"
              className={cn("input-base tracking-[0.08em] uppercase", error && "border-[var(--status-rejected)]")}
              style={{ fontSize: "16px" }}
            />
            <p className="text-[11px] text-[var(--on-surface-variant)]">英大文字と数字 8桁（例: AAAA-2222）</p>
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
