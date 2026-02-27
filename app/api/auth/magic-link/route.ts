import { NextResponse } from "next/server";
import { issueSigninCode } from "@/lib/auth/send-signin-code";
import { createRouteHandlerClient } from "@/lib/supabase/server";

// Backward compatibility endpoint.
// Internally this now issues email OTP via Supabase Auth.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const nameInput = String(body?.name || "").trim();

    const result = await issueSigninCode({ email, nameInput });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const anon = await createRouteHandlerClient();
    const { error } = await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      bootstrap: result.bootstrap ?? false,
    });
  } catch {
    return NextResponse.json({ error: "認証コードの発行に失敗しました" }, { status: 500 });
  }
}
