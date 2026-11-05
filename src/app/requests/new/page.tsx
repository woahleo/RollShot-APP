import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { carLabel, type Car } from "@/lib/types";
import RequestForm from "./RequestForm";

export default async function NewRequest() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?role=client&next=/requests/new");
  if (!profile) redirect("/onboarding?role=client");
  if (profile.role !== "client") redirect("/requests");
  const [{ data }, { data: last }] = await Promise.all([
    supabase.from("cars").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("requests").select("city").eq("client_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: 6 }}>Post a request<em>.</em></h1>
      <p className="lede">Pick a date. Creators send you offers, you compare their work and prices, and choose one. Only your city shows, never your name or address.</p>
      <RequestForm cars={((data ?? []) as Car[]).map(carLabel).filter(Boolean)} city={(last as { city: string } | null)?.city ?? ""} />
    </main>
  );
}
