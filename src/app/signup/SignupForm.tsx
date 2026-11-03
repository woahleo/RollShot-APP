"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "client" | "pro";

export default function SignupForm({ initialRole, next, linkError, providers }: { initialRole: Role | null; next: string; linkError: string; providers: { google: boolean; apple: boolean } }) {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(linkError);
  const [busy, setBusy] = useState(false);

  function callback() {
    const q = new URLSearchParams();
    if (role) q.set("role", role);
    if (next) q.set("next", next);
    return `${window.location.origin}/auth/callback?${q}`;
  }

  async function oauth(provider: "google" | "apple") {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback(), queryParams: { prompt: "select_account" } } });
    if (error) { setError(error.message); setBusy(false); }
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }

  if (sent) {
    return (
      <div className="card">
        <h3>Check your email</h3>
        <p className="muted">We sent a sign-in link to {email}. Open it on this device.</p>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 40 }}>{role === "pro" ? "Get booked." : role === "client" ? "Book a shoot." : "Join Rollshot."}</h1>
      <div className="seg wide" role="group" aria-label="Account type" style={{ marginBottom: 20 }}>
        <button type="button" aria-pressed={role === "client"} onClick={() => setRole("client")}>I own a car</button>
        <button type="button" aria-pressed={role === "pro"} onClick={() => setRole("pro")}>I shoot cars</button>
      </div>
      {(providers.google || providers.apple) && (
        <>
          <div className="list">
            {providers.google && <button className="btn" disabled={busy} onClick={() => oauth("google")}>Continue with Google</button>}
            {providers.apple && <button className="btn" disabled={busy} onClick={() => oauth("apple")}>Continue with Apple</button>}
          </div>
          <div className="divider">or</div>
        </>
      )}
      <form onSubmit={magic}>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <button className="btn solid" disabled={busy}>Email me a sign-in link</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="small muted">Already have an account? Use the same button, it signs you in.</p>
    </>
  );
}
