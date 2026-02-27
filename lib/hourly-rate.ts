import { supabase } from "@/lib/supabase/client";
import { HourlyRate } from "@/lib/types";

export type HourlyRateResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * ユーザーの時給履歴を取得
 */
export async function getHourlyRates(userId: string): Promise<HourlyRateResult<HourlyRate[]>> {
  const { data, error } = await supabase.rpc("get_hourly_rates", { p_user_id: userId });
  if (error) {
    return { ok: false, error: error.message };
  }
  const rates: HourlyRate[] = (data ?? []).map((row: { id: string; user_id: string; hourly_rate: number; effective_until: string; created_at: string }) => ({
    id: row.id,
    userId: row.user_id,
    hourlyRate: row.hourly_rate,
    effectiveUntil: row.effective_until,
    createdAt: row.created_at,
  }));
  return { ok: true, data: rates };
}

/**
 * 特定の日付に適用される時給を取得
 */
export async function getHourlyRateForDate(userId: string, date: string): Promise<HourlyRateResult<number | null>> {
  const { data, error } = await supabase.rpc("get_hourly_rate_for_date", { p_user_id: userId, p_date: date });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

/**
 * 時給を設定（UPSERT）
 */
export async function setHourlyRate(
  userId: string,
  hourlyRate: number,
  effectiveUntil: string
): Promise<HourlyRateResult<string>> {
  const { data, error } = await supabase.rpc("set_hourly_rate", {
    p_user_id: userId,
    p_hourly_rate: hourlyRate,
    p_effective_until: effectiveUntil,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

/**
 * 時給設定を削除
 */
export async function deleteHourlyRate(rateId: string): Promise<HourlyRateResult<void>> {
  const { error } = await supabase.rpc("delete_hourly_rate", { p_rate_id: rateId });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/**
 * 期間の締め日を計算（20日締め）
 * @param year 年
 * @param month 月 (1-12)
 * @returns YYYY-MM-DD形式の締め日
 */
export function getClosingDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-20`;
}

/**
 * 締め日から年月ラベルを生成
 * @param effectiveUntil YYYY-MM-DD形式の締め日
 * @returns "YYYY年M月分"形式のラベル
 */
export function formatEffectiveUntilLabel(effectiveUntil: string): string {
  const [year, month] = effectiveUntil.split("-");
  return `${year}年${Number(month)}月分`;
}
