import SignupForm from "./SignupForm";
import { isApp } from "@/lib/app";
import SignedInAs from "@/components/SignedInAs";
import { accountLabel } from "@/lib/account";
import { getMe } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import AgeBlocked from "@/components/AgeBlocked";
import { AGE_BLOCK_COOKIE } from "@/lib/legal";

/** Which social sign-ins are switched on in Supabase, so we never show a button that errors. */
async function enabledProviders(): Promise<{ google: boolean; apple: boolean }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 60 },
    });
    const s = (await res.json()) as { external?: Record<string, boolean> };
    return { google: !!s.external?.google, apple: !!s.external?.apple };
  } catch {
    return { google: false, apple: false };
  }
}

/** A plain-English reason the last sign-in didn't finish, with the code at the end so it can be looked up. */
function signInProblem(reason: string, viaSiteUrl: boolean, host: string) {
  const code = reason ? ` (${reason})` : "";
  if (reason === "pkce_code_verifier_not_found") {
    if (viaSiteUrl)
      return `Sign-in came back to ${host}, which isn't the address you started on. Open Rollshot at ${host} and try again.${code}`;
    return `Sign-in finished in a different browser from where it started. Open Rollshot in your normal browser (Safari or Chrome, not inside another app) and try again.${code}`;
  }
  if (reason === "flow_state_not_found" || reason === "flow_state_expired" || reason === "otp_expired")
    return `That sign-in link expired or was already used. Try again.${code}`;
  if (reason === "bad_code_verifier") return `Two sign-ins got mixed up. Close other Rollshot tabs and try once more.${code}`;
  if (reason === "access_denied") return `Sign-in was cancelled. Try again when you're ready.${code}`;
  return `Sign-in didn't finish. Try again.${code}`;
}

export default async function Signup({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; error?: string; reason?: string; via?: string }> }) {
  const sp = await searchParams;
  const role = sp.role === "pro" ? "pro" : sp.role === "client" ? "client" : null;
  const { supabase, user, profile } = await getMe();
  if (user) {
    // Already signed in: say which account this is instead of a sign-in form that would ignore the choice.
    const label = await accountLabel(supabase, profile);
    return (
      <main className="wrap">
        <div className="auth">
          <SignedInAs profile={profile} label={label} email={user.email ?? ""} wanted={role} />
        </div>
      </main>
    );
  }
  if ((await cookies()).has(AGE_BLOCK_COOKIE)) {
    return (
      <main className="wrap">
        <div className="auth"><AgeBlocked /></div>
      </main>
    );
  }
  const providers = await enabledProviders();
  const host = (await headers()).get("host") ?? "";
  const linkError = sp.error === "link" ? signInProblem(sp.reason ?? "", sp.via === "site", host) : "";
  return (
    <main className="wrap">
      <div className="auth">
        <SignupForm initialRole={role} next={sp.next ?? ""} linkError={linkError} providers={providers} inApp={isApp((await headers()).get("user-agent"))} />
      </div>
    </main>
  );
}
