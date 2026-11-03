import Link from "next/link";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { carLabel, photoUrl, type Car, type Package, type Pro } from "@/lib/types";
import { today } from "@/lib/sun";
import BookForm from "./BookForm";
import MessageButton from "./MessageButton";

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

  return (
    <main className="wrap">
      <p className="eyebrow">{pro.city}</p>
      <h1>{pro.profiles?.name}</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        {pro.shoot_types.map((t) => (
          <span key={t} className="badge">{t}</span>
        ))}
        {contact?.instagram && (
          <a className="small" href={`https://instagram.com/${encodeURIComponent(contact.instagram)}`} target="_blank" rel="noreferrer">@{contact.instagram}</a>
        )}
        {contact?.phone && <a className="small" href={`tel:${contact.phone}`}>{contact.phone}</a>}
      </div>
      <div className="split">
        <div>
          {pro.about && <p style={{ marginTop: 0 }}>{pro.about}</p>}
          {pro.photos.length > 0 ? (
            <div className="gallery">
              {pro.photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={ph} src={photoUrl(ph)} alt="" loading="lazy" />
              ))}
            </div>
          ) : (
            <p className="notice">No portfolio photos yet.</p>
          )}
        </div>
        <aside className="card" style={{ alignSelf: "start" }}>
          <h3>Book a shoot</h3>
          {!user && (
            <p className="small muted">
              <Link href={`/signup?role=client&next=/p/${pro.id}`}>Sign up</Link> to request a date.
            </p>
          )}
          {user && !canBook && user.id !== pro.id && <p className="small muted">Bookings are made from a car owner account.</p>}
          {user?.id === pro.id && <p className="small muted">This is how clients see your page.</p>}
          {canBook && (
            <>
              <BookForm packages={packages} dates={dates} cars={cars.map(carLabel).filter(Boolean)} />
              <div className="divider">questions first?</div>
              <MessageButton proId={pro.id} />
            </>
          )}
          {!canBook && packages.length > 0 && (
            <div className="list small" style={{ marginTop: 12 }}>
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
    </main>
  );
}
