import { createSecretSupabaseClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

type IssueSigninCodeResult =
  | { ok: true; bootstrap?: boolean }
  | { ok: false; status: number; error: string };

export async function issueSigninCode(params: {
  email: string;
  nameInput?: string;
}): Promise<IssueSigninCodeResult> {
  const email = params.email.trim().toLowerCase();
  const nameInput = (params.nameInput ?? "").trim();
  if (!email) {
    return { ok: false, status: 400, error: "メールアドレスを入力してください" };
  }

  const admin = createSecretSupabaseClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, active")
    .eq("email", email)
    .single();

  let bootstrap = false;

  if (profileError || !profile) {
    const bootstrapEmail = String(process.env.FIRST_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    if (!(bootstrapEmail && email === bootstrapEmail)) {
      return { ok: false, status: 404, error: "アカウントが見つかりません" };
    }

    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) > 0) {
      return { ok: false, status: 404, error: "アカウントが見つかりません" };
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { name: nameInput || email },
    });
    if (createError || !created?.user) {
      return { ok: false, status: 400, error: createError?.message || "管理者作成に失敗しました" };
    }

    const { error: insertError } = await admin.from("profiles").insert({
      id: created.user.id,
      email,
      name: nameInput || email,
      role: "admin",
      active: true,
      request_type: "fix",
    });
    if (insertError) {
      return { ok: false, status: 400, error: insertError.message };
    }

    bootstrap = true;
  } else if (!profile.active) {
    return { ok: false, status: 403, error: "このアカウントは無効化されています" };
  }

  return { ok: true, bootstrap };
}
