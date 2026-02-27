import { NextResponse } from "next/server";
import { createSecretSupabaseClient } from "@/lib/supabase/server";

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, error: "認証が必要です" } as const;
  }

  const admin = createSecretSupabaseClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "認証が必要です" } as const;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "権限がありません" } as const;
  }
  if (!profile.active || profile.role !== "admin") {
    return { ok: false, status: 403, error: "権限がありません" } as const;
  }

  return { ok: true, admin } as const;
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const role = String(body?.role || "staff");
  const requestType = String(body?.requestType || "fix");
  if (!["admin", "reviewer", "staff"].includes(role)) {
    return NextResponse.json({ error: "ロールが不正です" }, { status: 400 });
  }
  if (role === "staff" && !["fix", "flex"].includes(requestType)) {
    return NextResponse.json({ error: "申請タイプが不正です" }, { status: 400 });
  }
  if (!name || !email) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const admin = gate.admin;
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited?.user) {
    return NextResponse.json({ error: inviteError?.message || "招待に失敗しました" }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    email,
    name,
    role,
    active: true,
    request_type: role === "staff" ? requestType : "fix",
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "idが必要です" }, { status: 400 });

  const updates: Record<string, any> = {};
  const admin = gate.admin;
  const { data: profileBefore, error: beforeError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();
  if (beforeError || !profileBefore) {
    return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 });
  }

  let nextRole = profileBefore.role as string;
  if (body?.name !== undefined) updates.name = String(body.name).trim();
  if (body?.email !== undefined) updates.email = String(body.email).trim().toLowerCase();
  if (body?.role !== undefined) {
    nextRole = String(body.role);
    if (!["admin", "reviewer", "staff"].includes(nextRole)) {
      return NextResponse.json({ error: "ロールが不正です" }, { status: 400 });
    }
    updates.role = nextRole;
  }
  if (nextRole !== "staff") {
    updates.request_type = "fix";
  } else if (body?.requestType !== undefined) {
    const nextType = String(body.requestType);
    if (!["fix", "flex"].includes(nextType)) {
      return NextResponse.json({ error: "申請タイプが不正です" }, { status: 400 });
    }
    updates.request_type = nextType;
  }
  if (body?.active !== undefined) updates.active = Boolean(body.active);

  if (updates.email) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, { email: updates.email });
    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }
  }

  const { error: profileError } = await admin.from("profiles").update(updates).eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
