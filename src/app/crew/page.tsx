import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import DateTile from "@/components/DateTile";
import Avatar from "@/components/Avatar";
import { prettyTime } from "@/lib/hours";
import { today } from "@/lib/sun";
import { proPath } from "@/lib/types";
import type { Gig, GigReply } from "@/lib/crew";
import { AnswerOffer, CloseJob, PickReply, ReplyJob } from "./CrewActions";
import AddToCalendar from "@/components/AddToCalendar";

type Person = { id: string; handle: string | null; profiles: { name: string; avatar: string | null } | null };
type Row = Gig & { poster: Person | null; target: Person | null; hired: Person | null };
type Mine = Row & { gig_replies: (GigReply & { pro: Person | null })[] };

const PERSON = "id, handle, profiles(name, avatar)";
const nameOf = (p: Person | null) => p?.profiles?.name ?? "A creator";

function GigTop({ g, who }: { g: Gig; who?: React.ReactNode }) {
  return (
    <div className="req-top">
      <DateTile day={g.shoot_date} />
      <div style={{ minWidth: 0 }}>
        <span className="eyebrow">{g.role}{g.pay === 0 ? " · for experience" : ""}</span>
        <h3>{g.pay === 0 ? "Unpaid" : `$${g.pay}`}{who ? <span className="muted" style={{ fontWeight: 300 }}> · {who}</span> : null}</h3>
        <span className="small muted">{[g.city, g.shoot_time ? prettyTime(g.shoot_time) : "Time in chat"].join(" · ")}</span>
      </div>
    </div>
  );
}

/**
 * Crew: creators hiring creators. Offers sent to you, jobs you're booked on, jobs you posted
 * (with who replied), and open jobs from other creators, your city first.
 */
export default async function Crew({ searchParams }: { searchParams: Promise<{ posted?: string; sent?: string; edited?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?next=/crew");
  if (!profile) redirect("/onboarding");
  if (profile.role !== "pro") redirect("/");
  const me = user.id;
  const now = today();
  const sel = `*, poster:pros!gigs_poster_id_fkey(${PERSON}), target:pros!gigs_target_id_fkey(${PERSON}), hired:pros!gigs_hired_id_fkey(${PERSON})`;
  const [{ data: pro }, { data: forMe }, { data: mineRows }, { data: openRows }, { data: myReplies }, { data: threadRows }] = await Promise.all([
    supabase.from("pros").select("city").eq("id", me).single(),
    supabase.from("gigs").select(sel).or(`target_id.eq.${me},hired_id.eq.${me}`).gte("shoot_date", now).order("shoot_date"),
    supabase.from("gigs").select(`${sel}, gig_replies(*, pro:pros(${PERSON}))`).eq("poster_id", me).gte("shoot_date", now).neq("status", "closed").order("shoot_date"),
    supabase.from("gigs").select(sel).is("target_id", null).eq("status", "open").neq("poster_id", me).gte("shoot_date", now).order("shoot_date").limit(40),
    supabase.from("gig_replies").select("gig_id, status").eq("pro_id", me),
    supabase.from("threads").select("id, pro_id, client_id").or(`pro_id.eq.${me},client_id.eq.${me}`),
  ]);
  const city = (pro as { city: string } | null)?.city ?? "";
  const chatWith = new Map(((threadRows ?? []) as { id: string; pro_id: string; client_id: string }[]).map((t) => [t.pro_id === me ? t.client_id : t.pro_id, t.id]));
  const chat = (other: string | null | undefined) => (other && chatWith.get(other) ? `/messages/${chatWith.get(other)}` : null);
  const incoming = (forMe ?? []) as Row[];
  const offers = incoming.filter((g) => g.target_id === me && g.status === "open");
  const booked = incoming.filter((g) => g.hired_id === me && g.status === "filled");
  const mine = (mineRows ?? []) as Mine[];
  const replied = new Set(((myReplies ?? []) as { gig_id: string }[]).map((r) => r.gig_id));
  const open = ((openRows ?? []) as Row[]).sort((a, b) => Number(b.city === city) - Number(a.city === city));

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Crew<em>.</em></h1>
          <p className="lede" style={{ margin: 0 }}>Hire another creator for a shoot, or pick up work from one.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn solid small" href="/crew/new">Post a job</Link>
          <Link className="btn small" href="/book">Find someone to hire</Link>
        </div>
      </div>
      {sp.posted && <p className="notice" style={{ marginTop: 16 }}>Job posted. Creators can say they&apos;re in now. You&apos;ll get a chat from each one.</p>}
      {sp.sent && <p className="notice" style={{ marginTop: 16 }}>Offer sent. They got it in chat too.</p>}
      {sp.edited && <p className="notice" style={{ marginTop: 16 }}>Changes saved. Anyone who replied got a notification.</p>}

      {offers.length > 0 && (
        <section>
          <h2>Offers for you</h2>
          <div className="grid">
            {offers.map((g) => (
              <div key={g.id} className="card req">
                <GigTop g={g} who={<>from <Link href={proPath(g.poster ?? { id: g.poster_id })}>{nameOf(g.poster)}</Link></>} />
                {g.note && <p className="small req-note">{g.note}</p>}
                <div className="req-foot">
                  {chat(g.poster_id) ? <Link className="small" href={chat(g.poster_id)!}>Message</Link> : <span />}
                  <AnswerOffer gig={g.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {booked.length > 0 && (
        <section>
          <h2>You&apos;re on</h2>
          <div className="grid">
            {booked.map((g) => (
              <div key={g.id} className="card req">
                <GigTop g={g} who={<>for {nameOf(g.poster)}</>} />
                {g.note && <p className="small req-note">{g.note}</p>}
                <div className="req-foot">
                  <span className="badge confirmed">Booked</span>
                  <div className="row" style={{ gap: 6 }}>
                    <AddToCalendar kind="gig" id={g.id} />
                    {chat(g.poster_id) && <Link className="btn small" href={chat(g.poster_id)!}>Message</Link>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Your jobs</h2>
        {mine.length === 0 ? (
          <p className="muted">Nothing posted. <Link href="/crew/new">Post a job</Link>, or open another creator&apos;s page and tap Hire.</p>
        ) : (
          <div className="grid">
            {mine.map((g) => {
              const direct = !!g.target_id;
              const replies = [...g.gig_replies].sort((a, b) => a.created_at.localeCompare(b.created_at));
              return (
                <div key={g.id} className="card req">
                  <GigTop g={g} who={direct ? <>offer to {nameOf(g.target)}</> : g.status === "filled" ? <>{nameOf(g.hired)} is on</> : undefined} />
                  {g.note && <p className="small req-note">{g.note}</p>}
                  {!direct && g.status === "open" && (
                    replies.length === 0 ? (
                      <p className="small muted" style={{ margin: 0 }}>No replies yet. Creators see it on their Crew page.</p>
                    ) : (
                      <div className="crew-replies">
                        {replies.map((r) => (
                          <div key={r.pro_id} className="crew-reply">
                            <Avatar name={nameOf(r.pro)} avatar={r.pro?.profiles?.avatar} size={36} />
                            <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                              <Link href={proPath(r.pro ?? { id: r.pro_id })}><b style={{ fontWeight: 400 }}>{nameOf(r.pro)}</b></Link>
                              {r.note && <span className="small muted" style={{ display: "block" }}>{r.note}</span>}
                            </div>
                            <div className="crew-reply-go">
                              {chat(r.pro_id) && <Link className="small" href={chat(r.pro_id)!}>Message</Link>}
                              <PickReply gig={g.id} pro={r.pro_id} name={nameOf(r.pro)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                  <div className="req-foot">
                    <span className={`badge ${g.status === "filled" ? "confirmed" : g.status === "declined" ? "declined" : "requested"}`}>
                      {g.status === "filled" ? "Filled" : g.status === "declined" ? "Declined" : direct ? "Waiting on them" : `${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}
                    </span>
                    {g.status === "open" ? (
                      <div className="row" style={{ gap: 6 }}>
                        <Link className="btn small" href={`/crew/${g.id}/edit`}>Edit</Link>
                        <CloseJob gig={g.id} direct={direct} />
                      </div>
                    ) : g.status === "filled" ? (
                      <div className="row" style={{ gap: 6 }}>
                        {g.shoot_date >= now && <AddToCalendar kind="gig" id={g.id} />}
                        {chat(g.hired_id) && <Link className="btn small" href={chat(g.hired_id)!}>Message</Link>}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2>Jobs from other creators</h2>
        {open.length === 0 ? (
          <p className="muted">No open jobs right now. They show up here as soon as someone posts.</p>
        ) : (
          <div className="grid">
            {open.map((g) => (
              <div key={g.id} className="card req">
                <GigTop g={g} who={<Link href={proPath(g.poster ?? { id: g.poster_id })}>{nameOf(g.poster)}</Link>} />
                {g.note && <p className="small req-note">{g.note}</p>}
                <div className="req-foot">
                  <span className="small muted">{g.city === city ? "In your city" : "Nearby"}</span>
                  <ReplyJob gig={g.id} replied={replied.has(g.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
