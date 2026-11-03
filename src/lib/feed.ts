import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFeed, type FeedPro, type FeedShot } from "@/components/Feed";

/** The shared feed: newest shoots, then photographers' cover photos. One post per photographer. */
export async function loadFeed(supabase: SupabaseClient, { size = 9, skipPro }: { size?: number; skipPro?: string } = {}) {
  const [{ data: proRows }, { data: shotRows }] = await Promise.all([
    supabase
      .from("pros")
      .select("*, profiles(name, avatar), packages(*)")
      .neq("photos", "{}")
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("shoot_posts")
      .select("*, pro:pros(kind, handle, profiles(name, avatar))")
      .eq("hidden_by_owner", false)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);
  let pros = (proRows ?? []) as FeedPro[];
  let shots = (shotRows ?? []) as unknown as FeedShot[];
  if (skipPro) {
    pros = pros.filter((p) => p.id !== skipPro);
    shots = shots.filter((s) => s.pro_id !== skipPro);
  }
  return { pros, shots, items: buildFeed(shots, pros, size) };
}
