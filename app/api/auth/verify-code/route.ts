import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    const token = code.replace(/\s|-/g, "");

    if (!email || !token) {
      return NextResponse.json({ error: "メールアドレスと認証コードを入力してください" }, { status: 400 });
    }

    const anon = await createRouteHandlerClient();
    const { error } = await anon.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "サインインに失敗しました" }, { status: 500 });
  }
}
