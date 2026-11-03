import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_LABEL, type Kind, type Profile } from "./types";

/** "Car owner account", "Photo creator account", "Video creator account" or "Photo + video creator account". */
export async function accountLabel(supabase: SupabaseClient, profile: Profile | null) {
  if (!profile) return null;
  if (profile.role === "client") return "Car owner account";
  const { data } = await supabase.from("pros").select("kind").eq("id", profile.id).maybeSingle();
  return `${KIND_LABEL[((data?.kind as Kind) ?? "photo")]} account`;
}
