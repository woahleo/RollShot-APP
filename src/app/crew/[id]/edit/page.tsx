import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { CrewRole } from "@/lib/crew";
import CrewForm from "../../new/CrewForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Change a crew job you posted, while nobody has been picked yet. */
export default async function EditCrewJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getMe();
  if (!user) redirect(`/signup?next=/crew/${id}/edit`);
  const { data } = await supabase
    .from("gigs")
    .select("id, poster_id, target_id, role, city, shoot_date, shoot_time, pay, note, status, gig_replies(pro_id), target:pros!gigs_target_id_fkey(profiles(name))")
    .eq("id", id)
    .maybeSingle();
  const g = data as unknown as {
    id: string; poster_id: string; target_id: string | null; role: CrewRole; city: string; shoot_date: string; shoot_time: string | null;
    pay: number; note: string | null; status: string; gig_replies: { pro_id: string }[]; target: { profiles: { name: string } | null } | null;
  } | null;
  if (!g || g.poster_id !== user.id) notFound();
  if (g.status !== "open") redirect("/crew");
  const target = g.target_id ? { id: g.target_id, name: g.target?.profiles?.name ?? "them", role: g.role } : undefined;
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <p className="eyebrow"><Link href="/crew">Crew</Link></p>
      <h1 style={{ marginBottom: 6 }}>{target ? <>Change your offer<em>.</em></> : <>Edit your job<em>.</em></>}</h1>
      <p className="lede">Change the day, time, pay or details.</p>
      <CrewForm
        city={g.city}
        target={target}
        gig={{ id: g.id, role: g.role, city: g.city, date: g.shoot_date, time: g.shoot_time, pay: g.pay, note: g.note, replies: g.gig_replies.length }}
      />
    </main>
  );
}
