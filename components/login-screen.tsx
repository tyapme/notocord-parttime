"use client";

import { useEffect, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const OTP_LENGTH = 8;
const OTP_COOLDOWN_SECONDS = 60;

export function LoginScreen() {
  const sendSignInCode = useAppStore((s) => s.sendSignInCode);
  const verifySignInCode = useAppStore((s) => s.verifySignInCode);

  const [email, setEmail] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendCodeToEmail = async (targetEmail: string) => {
    setSendingCode(true);
    const res = await sendSignInCode(targetEmail);
    setSendingCode(false);
    if (!res.ok) {
      setError(res.error || "認証コードの送信に失敗しました");
      return false;
    }
    setCooldown(OTP_COOLDOWN_SECONDS);
    return true;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingCode) return;

    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("メールアドレスを入力してください");
      return;
    }

    const ok = await sendCodeToEmail(normalizedEmail);
    if (!ok) return;

    setEmail(normalizedEmail);
    setActiveEmail(normalizedEmail);
    setCode("");
    setStep("code");
  };

  const handleVerify = async (rawCode: string) => {
    if (verifying) return;
    const normalizedCode = rawCode.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (normalizedCode.length !== OTP_LENGTH) return;
    if (!activeEmail) {
      setError("メールアドレスを入力し直してください");
      setStep("email");
      return;
    }

    setError("");
    setVerifying(true);
    const res = await verifySignInCode({ email: activeEmail, code: normalizedCode });
    setVerifying(false);
    if (!res.ok) {
      setError(res.error || "サインインに失敗しました");
      setCode("");
    }
  };

  const handleResend = async () => {
    if (!activeEmail || cooldown > 0 || sendingCode) return;
    setError("");
    await sendCodeToEmail(activeEmail);
  };

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
    setError("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="surface-card-subtle w-full max-w-sm px-6 py-7">
        <div className="mb-8">
          <p className="text-lg font-semibold tracking-tight text-foreground">notocord</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">ログイン</h1>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-4" noValidate>
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
                }}
                placeholder="user@example.com"
                className={cn("input-base", error && "border-[var(--status-rejected)]")}
                style={{ fontSize: "16px" }}
              />
            </div>

            {error && (
              <p className="text-xs font-medium text-[var(--status-rejected)]" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sendingCode}
              className={cn("button-primary w-full", sendingCode ? "bg-muted text-muted-foreground cursor-not-allowed" : "")}
            >
              {sendingCode ? "送信中..." : "ログイン"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="otp-code">
                認証コード
              </label>
              <InputOTP
                id="otp-code"
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError("");
                }}
                onComplete={handleVerify}
                pattern={REGEXP_ONLY_DIGITS}
                maxLength={OTP_LENGTH}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                pasteTransformer={(pasted) => pasted.replace(/\D/g, "")}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      aria-invalid={Boolean(error)}
                      className="h-12 w-11 rounded-[14px] border text-lg font-semibold"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {verifying && <p className="text-xs text-[var(--on-surface-variant)]">サインイン中...</p>}
            {error && (
              <p className="text-xs font-medium text-[var(--status-rejected)]" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="font-medium text-[var(--on-surface-variant)] hover:text-foreground"
              >
                メールアドレスを変更
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || sendingCode}
                className={cn(
                  "font-medium text-[var(--primary)]",
                  cooldown > 0 || sendingCode ? "opacity-50 cursor-not-allowed" : "hover:underline"
                )}
              >
                {cooldown > 0 ? `再送信まで ${cooldown}秒` : "認証コードを再送信"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
