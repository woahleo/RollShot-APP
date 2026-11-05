import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AGE_BLOCK_COOKIE } from "@/lib/legal";
import { getMe } from "@/lib/supabase/server";
import Onboarding from "./Onboarding";

export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (profile) redirect(profile.role === "pro" ? "/pro" : "/book");
  const sp = await searchParams;
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  const blocked = (await cookies()).has(AGE_BLOCK_COOKIE);
  return (
    <main className="wrap">
      <div className="auth">
        <Onboarding userId={user.id} defaultName={name} initialRole={sp.role === "pro" ? "pro" : sp.role === "client" ? "client" : null} blocked={blocked} />
      </div>
    </main>
  );
}
