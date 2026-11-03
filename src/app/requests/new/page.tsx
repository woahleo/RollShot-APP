import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { carLabel, type Car } from "@/lib/types";
import RequestForm from "./RequestForm";

export default async function NewRequest() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?role=client&next=/requests/new");
  if (!profile) redirect("/onboarding?role=client");
  if (profile.role !== "client") redirect("/requests");
  const { data } = await supabase.from("cars").select("*").eq("owner_id", user.id).order("created_at");
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: 6 }}>Post a request<em>.</em></h1>
      <p className="lede">Pick a date. Photographers send you offers, you compare their work and prices, and choose one. Only your city shows, never your name or address.</p>
      <RequestForm cars={((data ?? []) as Car[]).map(carLabel).filter(Boolean)} />
    </main>
  );
}
