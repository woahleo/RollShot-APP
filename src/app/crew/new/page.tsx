import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { proKey, type Kind } from "@/lib/types";
import type { CrewRole } from "@/lib/crew";
import CrewForm from "./CrewForm";

export default async function NewCrewJob({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?next=/crew/new");
  if (!profile) redirect("/onboarding");
  if (profile.role !== "pro") redirect("/");
  const { data: me } = await supabase.from("pros").select("city").eq("id", user.id).maybeSingle();
  let target: { id: string; name: string; role: CrewRole; city: string } | undefined;
  if (to) {
    const key = to.toLowerCase();
    const { data } = await supabase.from("pros").select("id, city, kind, profiles(name)").eq(proKey(key), key).maybeSingle();
    const t = data as unknown as { id: string; city: string; kind: Kind | null; profiles: { name: string } | null } | null;
    if (t && t.id !== user.id) target = { id: t.id, city: t.city, name: t.profiles?.name ?? "them", role: t.kind === "video" ? "Videographer" : "Second shooter" };
  }

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <p className="eyebrow"><Link href="/crew">Crew</Link></p>
      <h1 style={{ marginBottom: 6 }}>{target ? <>Hire {target.name}<em>.</em></> : <>Post a crew job<em>.</em></>}</h1>
      <p className="lede">
        {target
          ? "Send an offer for one shoot. Once they accept, chat fully opens between you two."
          : "Need a second shooter, a videographer or a drone pilot? Post the day and the pay, creators say they're in, and you pick one."}
      </p>
      <CrewForm city={(me as { city: string } | null)?.city ?? target?.city ?? "Miami"} target={target} />
    </main>
  );
}
