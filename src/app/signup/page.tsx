import SignupForm from "./SignupForm";

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

export default async function Signup({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; error?: string }> }) {
  const sp = await searchParams;
  const role = sp.role === "pro" ? "pro" : sp.role === "client" ? "client" : null;
  const providers = await enabledProviders();
  return (
    <main className="wrap">
      <div className="auth">
        <SignupForm initialRole={role} next={sp.next ?? ""} linkError={sp.error === "link"} providers={providers} />
      </div>
    </main>
  );
}
