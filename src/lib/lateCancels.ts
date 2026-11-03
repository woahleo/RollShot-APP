import type { SupabaseClient } from "@supabase/supabase-js";

/** Late-cancel counts for these people, as a map. People with none are left out. */
export async function lateCancels(supabase: SupabaseClient, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map<string, number>();
  const { data } = await supabase.rpc("late_cancel_counts", { p_users: unique });
  return new Map(((data ?? []) as { user_id: string; n: number }[]).map((r) => [r.user_id, r.n]));
}

export const lateLabel = (n: number | undefined) => (n ? `${n} late cancel${n === 1 ? "" : "s"}` : "");
