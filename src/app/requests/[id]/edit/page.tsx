import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { carLabel, type Car } from "@/lib/types";
import type { Request } from "../../page";
import RequestForm from "../../new/RequestForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Change your request while it's still open. */
export default async function EditRequest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getMe();
  if (!user) redirect(`/signup?next=/requests/${id}/edit`);
  const { data } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
  const r = data as Request | null;
  if (!r || r.client_id !== user.id) notFound();
  if (r.status !== "open") redirect(`/requests/${id}`);
  const [{ data: cars }, { count }] = await Promise.all([
    supabase.from("cars").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("request_replies").select("pro_id", { count: "exact", head: true }).eq("request_id", id),
  ]);
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <p className="eyebrow"><Link href={`/requests/${id}`}>Your request</Link></p>
      <h1 style={{ marginBottom: 6 }}>Edit your request<em>.</em></h1>
      <p className="lede">Change the car, date, budget or anything else. Creators see the new version right away.</p>
      <RequestForm
        cars={((cars ?? []) as Car[]).map(carLabel).filter(Boolean)}
        draft={{ id: r.id, car: r.car, shoot_type: r.shoot_type, kind: r.kind, city: r.city, date: r.date_from, budget: r.budget, free: !!r.free, note: r.note, offers: count ?? 0 }}
      />
    </main>
  );
}
