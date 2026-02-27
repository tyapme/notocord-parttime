import { supabase } from "@/lib/supabase/client";
import { HourlyRate } from "@/lib/types";

export type HourlyRateResult<T> = { ok: true; data: T } | { ok: false; error: string };

type HourlyRateRow = {
    id: string;
    user_id: string;
    hourly_rate: number;
    effective_from?: string | null;
    effective_until?: string | null;
    created_at: string;
};

function compareEffectiveFromDesc(a: string | null, b: string | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b.localeCompare(a);
}

function isSchemaCacheFunctionMismatch(error: { message: string; code?: string }): boolean {
    return (
        error.code === "PGRST202" ||
        error.message.includes("schema cache") ||
        error.message.includes("Could not find the function public.set_hourly_rate")
    );
}

/**
 * ユーザーの時給履歴を取得
 */
export async function getHourlyRates(userId: string): Promise<HourlyRateResult<HourlyRate[]>> {
    const { data, error } = await supabase.rpc("get_hourly_rates", { p_user_id: userId });
    if (error) {
        return { ok: false, error: error.message };
    }
    const rates: HourlyRate[] = (data ?? []).map((row: HourlyRateRow) => ({
        id: row.id,
        userId: row.user_id,
        hourlyRate: row.hourly_rate,
        effectiveFrom: row.effective_from ?? row.effective_until ?? null,
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
    effectiveFrom?: string | null
): Promise<HourlyRateResult<string>> {
    const nextEffectiveFrom = effectiveFrom ?? null;
    const { data, error } = await supabase.rpc("set_hourly_rate", {
        p_user_id: userId,
        p_hourly_rate: hourlyRate,
        p_effective_from: nextEffectiveFrom,
    });
    if (!error) {
        return { ok: true, data };
    }

    if (!isSchemaCacheFunctionMismatch(error)) {
        return { ok: false, error: error.message };
    }

    // 旧RPC引数名（p_effective_until）への互換フォールバック
    if (nextEffectiveFrom === null) {
        return {
            ok: false,
            error: "DBの時給RPCが旧定義のため、開始日なしの初回設定はまだ使えません。`supabase/phase1.sql` を適用し、Schema Cache を再読み込みしてください。",
        };
    }

    const legacyResult = await supabase.rpc("set_hourly_rate", {
        p_user_id: userId,
        p_hourly_rate: hourlyRate,
        p_effective_until: nextEffectiveFrom,
    });

    if (legacyResult.error) {
        return { ok: false, error: legacyResult.error.message };
    }

    return { ok: true, data: legacyResult.data };
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
 * 対象日に適用される時給設定を取得
 */
export function getApplicableHourlyRate(rates: HourlyRate[], targetDate: string): HourlyRate | null {
    const matchedRates = rates
        .filter((rate) => rate.effectiveFrom !== null && rate.effectiveFrom <= targetDate)
        .sort((a, b) => compareEffectiveFromDesc(a.effectiveFrom, b.effectiveFrom));

    if (matchedRates.length > 0) {
        return matchedRates[0];
    }

    return rates.find((rate) => rate.effectiveFrom === null) ?? null;
}

/**
 * 設定日順（新しい順）にソート
 */
export function sortHourlyRatesByEffectiveFromDesc(rates: HourlyRate[]): HourlyRate[] {
    return [...rates].sort((a, b) => compareEffectiveFromDesc(a.effectiveFrom, b.effectiveFrom));
}

/**
 * 適用開始日の表示ラベルを生成
 */
export function formatEffectiveFromLabel(effectiveFrom: string | null): string {
    if (!effectiveFrom) {
        return "初回設定";
    }
    return effectiveFrom.replaceAll("-", "/");
}
