import Link from "next/link";
import SignedInAs from "@/components/SignedInAs";
import { accountLabel } from "@/lib/account";
import { getMe } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const { supabase, user, profile } = await getMe();
  const label = await accountLabel(supabase, profile);
  return (
    <main className="wrap">
      <p className="eyebrow">West Palm Beach · Boca · Fort Lauderdale · Miami</p>
      {deleted && <p className="notice">Your account was deleted.</p>}
      <h1>Your car, shot <em>right.</em></h1>
      <p className="lede">Book local car photographers and videographers by the shoot. See their work, pick an open date with golden hour times, and chat once you request.</p>
      {user ? (
        <SignedInAs profile={profile} label={label} email={user.email ?? ""} wanted={null} />
      ) : (
        <div className="choice">
          <Link href="/signup?role=client" className="card">
            <span className="eyebrow">I own a car</span>
            <h3>Book a photographer</h3>
            <p className="muted small">Browse photographers and videographers, add your car to your garage, request a date.</p>
          </Link>
          <Link href="/signup?role=pro" className="card">
            <span className="eyebrow">I&apos;m a photographer or videographer</span>
            <h3>Get booked for car shoots</h3>
            <p className="muted small">Build your profile, post open dates and packages, get booking requests.</p>
          </Link>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 24 }}>
        Just looking? <Link href="/book">See who&apos;s shooting this week</Link>.
      </p>
    </main>
  );
}
