import Link from "next/link";
import type { Profile } from "@/lib/types";

/**
 * Shown when someone who is already signed in picks a role. One account is one role,
 * so picking the other side means signing out and using a different email or Google account.
 */
export default function SignedInAs({ profile, label, email, wanted }: { profile: Profile | null; label: string | null; email: string; wanted: "client" | "pro" | null }) {
  if (!profile) {
    return (
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>You&apos;re signed in as {email}</h3>
        <p className="muted small" style={{ margin: 0 }}>Finish setting up your account to continue.</p>
        <Link className="btn solid" href={`/onboarding${wanted ? `?role=${wanted}` : ""}`}>Finish setup</Link>
      </div>
    );
  }
  const home = profile.role === "pro" ? "/pro" : "/book";
  const mismatch = wanted && wanted !== profile.role;
  const other = profile.role === "pro" ? "a car owner" : "a photographer or videographer";
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <span className="badge" style={{ justifySelf: "start" }}>{label}</span>
      <h3 style={{ margin: 0 }}>You&apos;re signed in as {profile.name}</h3>
      <p className="muted small" style={{ margin: 0 }}>
        {email}
        {mismatch
          ? ` is already set up as a ${label?.replace(" account", "").toLowerCase()}. Each account is one or the other. You can switch this account to ${other} in Settings, or sign out and use a different email or Google account.`
          : ""}
      </p>
      <div className="row">
        <Link className="btn solid" href={home}>{profile.role === "pro" ? "Go to my dashboard" : "Find a photographer"}</Link>
        {mismatch && (
          <Link className="btn solid" href="/settings">Switch this account to {profile.role === "pro" ? "a car owner" : "a photographer"}</Link>
        )}
        <form action="/auth/signout" method="post">
          <button className="btn" type="submit">Sign out{mismatch ? ` to join as ${profile.role === "pro" ? "a car owner" : "a photographer"}` : ""}</button>
        </form>
      </div>
    </div>
  );
}
