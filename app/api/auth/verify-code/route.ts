import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { challengeExpired, isSigninCodeFormat, normalizeSigninCode, parseSigninChallenge, verifyCodeHash } from "@/lib/auth/signin-code";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "");
    const challenge = String(body?.challenge || "");

    if (!email || !code || !challenge) {
      return NextResponse.json({ error: "メールアドレスと認証コードを入力してください" }, { status: 400 });
    }
    if (!isSigninCodeFormat(code)) {
      return NextResponse.json({ error: "認証コード形式が不正です" }, { status: 400 });
    }

    const payload = parseSigninChallenge(challenge);
    if (!payload) {
      return NextResponse.json({ error: "認証コードが無効です。再発行してください" }, { status: 400 });
    }
    if (challengeExpired(payload.expiresAt)) {
      return NextResponse.json({ error: "認証コードの有効期限が切れました。再発行してください" }, { status: 400 });
    }
    if (payload.email !== email) {
      return NextResponse.json({ error: "メールアドレスが一致しません" }, { status: 400 });
    }
    if (!verifyCodeHash(normalizeSigninCode(code), payload.codeHash)) {
      return NextResponse.json({ error: "認証コードが正しくありません" }, { status: 400 });
    }

    const anon = await createRouteHandlerClient();
    const { error } = await anon.auth.signInWithPassword({
      email,
      password: payload.tempPassword,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "サインインに失敗しました" }, { status: 500 });
  }
}
