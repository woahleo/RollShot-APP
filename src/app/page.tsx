import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap">
      <p className="eyebrow">West Palm Beach · Boca · Fort Lauderdale · Miami</p>
      <h1>Your car, shot <em>right.</em></h1>
      <p className="lede">Book local car photographers and videographers by the shoot. See their work, pick an open date with golden hour times, and chat once you request.</p>
      <div className="choice">
        <Link href="/signup?role=client" className="card">
          <span className="eyebrow">I own a car</span>
          <h3>Book a shoot</h3>
          <p className="muted small">Browse shooters, add your car to your garage, request a date.</p>
        </Link>
        <Link href="/signup?role=pro" className="card">
          <span className="eyebrow">I shoot cars</span>
          <h3>Get booked</h3>
          <p className="muted small">Build your profile, post open dates and packages, get paid requests.</p>
        </Link>
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>
        Just looking? <Link href="/book">See who&apos;s shooting this week</Link>.
      </p>
    </main>
  );
}
