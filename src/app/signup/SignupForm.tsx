"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MIN_AGE } from "@/lib/legal";
import { REVIEW_EMAIL } from "@/lib/app";

type Role = "client" | "pro";

/**
 * The sign-in email has a link (works on any device, see /auth/confirm) and a code, which can be
 * typed here, handy when the email is opened on another device. In the iPhone app, Google is hidden
 * (Google blocks sign-in inside apps) and the code is the way in, since the link opens Safari.
 */
export default function SignupForm({ initialRole, next, linkError, providers, inApp = false }: { initialRole: Role | null; next: string; linkError: string; providers: { google: boolean; apple: boolean }; inApp?: boolean }) {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(linkError);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const review = email.trim().toLowerCase() === REVIEW_EMAIL;
  const google = providers.google && !inApp;

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

  // After the code or password signs them in, the callback sends them to onboarding or home.
  function signedIn() {
    window.location.assign(callback().replace(window.location.origin, ""));
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await createClient().auth.verifyOtp({ email, token: code.replace(/\D/g, ""), type: "email" });
    if (error) { setBusy(false); setError("That code didn't work. Check the newest email from us, or send a new one."); return; }
    signedIn();
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    if (review) {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setBusy(false); setError(error.message); return; }
      return signedIn();
    }
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }

  if (sent) {
    return (
      <div className="card">
        <h3>Check your email</h3>
        <p className="muted">
          {inApp
            ? <>We sent a code to {email}. Type it here to sign in.</>
            : <>We sent a link and a code to {email}. Tap the link on any device, or type the code here.</>}
        </p>
        <form onSubmit={checkCode}>
          <label className="field">
            <span>Code</span>
            <input inputMode="numeric" autoComplete="one-time-code" required maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </label>
          <button className="btn solid" disabled={busy || code.replace(/\D/g, "").length < 6}>Sign in</button>
        </form>
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn small" style={{ marginTop: 12 }} onClick={() => { setSent(false); setCode(""); setError(""); }}>Use a different email</button>
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
      {(google || providers.apple) && (
        <>
          <div className="list">
            {google && <button className="btn" disabled={busy} onClick={() => oauth("google")}>Continue with Google</button>}
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
        {review && (
          <label className="field">
            <span>Password</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
        )}
        <button className="btn solid" disabled={busy}>{review ? "Sign in" : inApp ? "Email me a code" : "Email me a sign-in link"}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="small muted">Already have an account? Use the same button, it signs you in.</p>
      <p className="small muted">Rollshot is for people {MIN_AGE} and older. By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </>
  );
}
