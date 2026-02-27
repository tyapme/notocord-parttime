import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const redirectTo = new URL("/", requestUrl.origin);

  if (!tokenHash || !type) {
    redirectTo.searchParams.set("auth_error", "invalid_link");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    redirectTo.searchParams.set("auth_error", "verify_failed");
  }

  return NextResponse.redirect(redirectTo);
}
