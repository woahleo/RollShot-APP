import Link from "next/link";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { KIND_LABEL, carLabel, photoUrl, type Car, type Kind, type Package, type Pro } from "@/lib/types";
import { today } from "@/lib/sun";
import BookForm from "./BookForm";
import { lateCancels, lateLabel } from "@/lib/lateCancels";
import MessageButton from "./MessageButton";
import Availability from "./Availability";
import ShotCard, { type ShotRow } from "@/components/ShotCard";

export default async function ProPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await getMe();
  const { data } = await supabase.from("pros").select("*, profiles(name), packages(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const pro = data as Pro & { profiles: { name: string } | null; packages: Package[] };
  const packages = [...pro.packages].sort((a, b) => a.position - b.position || a.price - b.price);
  const dates = pro.open_dates.filter((d) => d >= today()).sort();
  let cars: Car[] = [];
  let contact: { instagram: string | null; phone: string | null } | null = null;
  if (user) {
    const [{ data: c }, { data: k }] = await Promise.all([
      supabase.from("cars").select("*").eq("owner_id", user.id),
      // Only returns a row once this client has a confirmed shoot with the photographer.
      supabase.from("pro_contacts").select("instagram, phone").eq("pro_id", id).maybeSingle(),
    ]);
    cars = (c ?? []) as Car[];
    contact = k;
  }
  const canBook = profile?.role === "client";
  const late = (await lateCancels(supabase, [pro.id])).get(pro.id);
  const { data: shotRows } = await supabase
    .from("shoot_posts")
    .select("*")
    .eq("pro_id", id)
    .eq("hidden_by_owner", false)
    .order("shoot_date", { ascending: false })
    .limit(6);
  const shots = (shotRows ?? []) as unknown as ShotRow[];
  const isMe = user?.id === pro.id;
  const name = pro.profiles?.name ?? "this photographer";
  const missing = [
    packages.length === 0 && "a package with a price",
    dates.length === 0 && "open dates",
    pro.photos.length === 0 && "portfolio photos",
  ].filter(Boolean) as string[];

  return (
    <main className="wrap">
      <p className="eyebrow">{KIND_LABEL[(pro.kind ?? "photo") as Kind]} · {pro.city}{late ? <span className="late"> · {lateLabel(late)}</span> : null}</p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 style={{ marginBottom: 0 }}>{pro.profiles?.name}</h1>
        {!isMe && <a className="btn solid book-jump" href="#book">Book now</a>}
      </div>
      <div className="row" style={{ margin: "12px 0 20px" }}>
        {pro.shoot_types.map((t) => (
          <span key={t} className="badge">{t}</span>
        ))}
        {contact?.instagram && (
          <a className="small" href={`https://instagram.com/${encodeURIComponent(contact.instagram)}`} target="_blank" rel="noreferrer">@{contact.instagram}</a>
        )}
        {contact?.phone && <a className="small" href={`tel:${contact.phone}`}>{contact.phone}</a>}
      </div>
      {isMe && (
        <div className="notice" style={{ marginBottom: 20 }}>
          <b>This is your public page.</b> Car owners see a Book now button and the booking form on the right.
          {missing.length > 0 && <> Before anyone can book you, add {missing.join(", ")}. <Link href="/pro/edit">Edit profile</Link> · <Link href="/pro">Open dates</Link></>}
        </div>
      )}
      <div className="split">
        <div>
          {pro.about && <p className="about">{pro.about}</p>}
          {pro.photos.length > 0 ? (
            <div className="gallery feature">
              {pro.photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={ph} src={photoUrl(ph)} alt="" loading="lazy" />
              ))}
            </div>
          ) : (
            <p className="notice">No portfolio photos yet.</p>
          )}
        </div>
        <aside id="book" className="card book-card">
          <h3>Book {name}</h3>
          {canBook && (
            <>
              <BookForm packages={packages} dates={dates} cars={cars.map(carLabel).filter(Boolean)} name={name} />
              <div className="divider">questions first?</div>
              <MessageButton proId={pro.id} />
            </>
          )}
          {!canBook && <Availability dates={dates} />}
          {!user && (
            <>
              <p className="small muted">Create a free car owner account to pick a package and a date. It takes a minute.</p>
              <Link className="btn solid" style={{ width: "100%" }} href={`/signup?role=client&next=/p/${pro.id}%23book`}>Sign up to book</Link>
            </>
          )}
          {user && !canBook && !isMe && (
            <p className="small muted">You&apos;re signed in with a photographer account. To book a shoot, sign out and sign in with a different account as a car owner account.</p>
          )}
          {!canBook && packages.length > 0 && (
            <div className="pkgs" style={{ marginTop: 16 }}>
              {packages.map((k) => (
                <div key={k.id}>
                  <span>{k.name}</span>
                  <b>${k.price}</b>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {shots.length > 0 && (
        <section style={{ marginTop: 8 }}>
          <h2>Recent shoots<em>.</em></h2>
          <p className="lede" style={{ marginBottom: 16 }}>Real shoots booked through Rollshot.</p>
          <div className="grid pros">
            {shots.map((s) => <ShotCard key={s.id} s={s} showPro={false} />)}
          </div>
        </section>
      )}
    </main>
  );
}
