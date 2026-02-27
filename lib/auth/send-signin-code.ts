import { createSecretSupabaseClient } from "@/lib/supabase/server";
import { createSigninChallenge, generateSigninCode, generateTempPassword } from "@/lib/auth/signin-code";

type IssueSigninCodeResult =
  | { ok: true; challenge: string; code: string; expiresAt: number; bootstrap?: boolean }
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

  let userId = profile?.id as string | undefined;
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

    const bootstrapPassword = generateTempPassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: bootstrapPassword,
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

    userId = created.user.id;
    bootstrap = true;
  } else if (!profile.active) {
    return { ok: false, status: 403, error: "このアカウントは無効化されています" };
  }

  if (!userId) {
    return { ok: false, status: 500, error: "ユーザー情報の取得に失敗しました" };
  }

  const tempPassword = generateTempPassword();
  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    email_confirm: true,
  });
  if (passwordError) {
    return { ok: false, status: 400, error: passwordError.message };
  }

  const code = generateSigninCode();
  const { challenge, expiresAt } = createSigninChallenge({
    email,
    userId,
    code,
    tempPassword,
  });

  return { ok: true, challenge, code, expiresAt, bootstrap };
}
