import { NextResponse } from "next/server";
import { createRouteHandlerClient, createSecretSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const nameInput = String(body?.name || "").trim();
    if (!email) {
      return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
    }

    const admin = createSecretSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, active")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      const bootstrapEmail = String(process.env.FIRST_ADMIN_EMAIL || "")
        .trim()
        .toLowerCase();
      if (bootstrapEmail && email === bootstrapEmail) {
        const { count } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if ((count ?? 0) === 0) {
          const { data: invited, error: inviteError } =
            await admin.auth.admin.inviteUserByEmail(email);
          if (inviteError || !invited?.user) {
            return NextResponse.json({ error: inviteError?.message || "招待に失敗しました" }, { status: 400 });
          }

          const { error: insertError } = await admin.from("profiles").insert({
            id: invited.user.id,
            email,
            name: nameInput || email,
            role: "admin",
            active: true,
            request_type: "fix",
          });
          if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 400 });
          }

          return NextResponse.json({ ok: true, bootstrap: true });
        }
      }

      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }
    if (!profile.active) {
      return NextResponse.json({ error: "このアカウントは無効化されています" }, { status: 403 });
    }

    const anon = await createRouteHandlerClient();
    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || undefined;
    const { error } = await anon.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
