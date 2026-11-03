import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Package, Pro } from "@/lib/types";
import EditPro from "./EditPro";
import { igReady } from "@/lib/instagram";

export default async function Page() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (profile?.role !== "pro") redirect("/onboarding");
  const [{ data: pro }, { data: packages }, { data: contact }] = await Promise.all([
    supabase.from("pros").select("*").eq("id", user.id).single(),
    supabase.from("packages").select("*").eq("pro_id", user.id).order("position"),
    supabase.from("pro_contacts").select("instagram, phone").eq("pro_id", user.id).maybeSingle(),
  ]);
  return (
    <main className="wrap">
      <h1>Your profile<em>.</em></h1>
      <EditPro userId={user.id} name={profile.name} avatar={profile.avatar ?? null} site={process.env.NEXT_PUBLIC_SITE_URL ?? "https://roll-shot-app.vercel.app"} pro={pro as Pro} packages={(packages ?? []) as Package[]} contact={contact} instagram={igReady()} />
    </main>
  );
}
