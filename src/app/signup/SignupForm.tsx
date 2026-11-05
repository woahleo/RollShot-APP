"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MIN_AGE } from "@/lib/legal";

type Role = "client" | "pro";

/** A US number as typed ("(305) 555-0123", "305.555.0123", "+1 305…") in the +13055550123 form texts go to. */
function toE164(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export default function SignupForm({ initialRole, next, linkError, providers }: { initialRole: Role | null; next: string; linkError: string; providers: { google: boolean; apple: boolean; phone: boolean } }) {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(linkError);
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [texted, setTexted] = useState<string | null>(null); // the number a code was sent to
  const [code, setCode] = useState("");

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

  async function textCode(e: React.FormEvent) {
    e.preventDefault();
    const to = toE164(phone);
    if (!to) return setError("Enter a 10-digit US phone number, like (305) 555-0123.");
    setBusy(true); setError("");
    const { error } = await createClient().auth.signInWithOtp({ phone: to });
    setBusy(false);
    if (error) setError(error.message); else { setTexted(to); setCode(""); }
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    if (!texted) return;
    setBusy(true); setError("");
    const { error } = await createClient().auth.verifyOtp({ phone: texted, token: code.trim(), type: "sms" });
    if (error) { setBusy(false); return setError(error.message.includes("expired") || error.message.includes("invalid") ? "That code didn't work. Check it, or send a new one." : error.message); }
    // Signed in. The callback sends them to set up their account, or wherever they were going.
    window.location.assign(callback());
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
      {providers.phone && (
        <div className="seg wide" role="group" aria-label="Sign in with" style={{ marginBottom: 14 }}>
          <button type="button" aria-pressed={via === "email"} onClick={() => { setVia("email"); setError(""); }}>Email</button>
          <button type="button" aria-pressed={via === "phone"} onClick={() => { setVia("phone"); setError(""); }}>Phone number</button>
        </div>
      )}
      {via === "phone" && providers.phone ? (
        texted ? (
          <form onSubmit={checkCode}>
            <label className="field">
              <span>Enter the 6-digit code we texted to {texted.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}</span>
              <input value={code} onChange={(e) => { setError(""); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required minLength={6} maxLength={6} autoFocus />
            </label>
            <button className="btn solid" disabled={busy || code.length < 6}>Sign in</button>
            <p className="small muted" style={{ marginTop: 10 }}>
              No text? <button type="button" className="linklike" disabled={busy} onClick={() => { setTexted(null); setCode(""); setError(""); }}>Change the number or send a new code</button>
            </p>
          </form>
        ) : (
          <form onSubmit={textCode}>
            <label className="field">
              <span>Phone number</span>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(305) 555-0123" autoComplete="tel" inputMode="tel" />
            </label>
            <button className="btn solid" disabled={busy}>Text me a code</button>
            <p className="small muted" style={{ marginTop: 10 }}>We&apos;ll text you a code to sign in. Message and data rates may apply.</p>
          </form>
        )
      ) : (
        <form onSubmit={magic}>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <button className="btn solid" disabled={busy}>Email me a sign-in link</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <p className="small muted">Already have an account? Use the same button, it signs you in.</p>
      <p className="small muted">Rollshot is for people {MIN_AGE} and older. By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </>
  );
}
