import { NextResponse } from "next/server";
import { issueSigninCode } from "@/lib/auth/send-signin-code";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const nameInput = String(body?.name || "").trim();

    const result = await issueSigninCode({ email, nameInput });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      challenge: result.challenge,
      code: result.code,
      expiresAt: result.expiresAt,
      bootstrap: result.bootstrap ?? false,
    });
  } catch {
    return NextResponse.json({ error: "認証コードの発行に失敗しました" }, { status: 500 });
  }
}
