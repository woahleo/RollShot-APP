import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AGE_BLOCK_COOKIE } from "@/lib/legal";
import { getMe } from "@/lib/supabase/server";
import Onboarding from "./Onboarding";

export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  // A creator whose sign-up saved their name but not their creator details (a failed save, or a
  // car owner switching over) finishes here, instead of landing on pages that need those details.
  let finishing = false;
  if (profile) {
    if (profile.role !== "pro") redirect("/book");
    const { data: pro } = await supabase.from("pros").select("id").eq("id", user.id).maybeSingle();
    if (pro) redirect("/pro");
    finishing = true;
  }
  const sp = await searchParams;
  const name = profile?.name ?? (user.user_metadata?.full_name as string | undefined) ?? "";
  const blocked = (await cookies()).has(AGE_BLOCK_COOKIE);
  return (
    <main className="wrap">
      <div className="auth">
        <Onboarding userId={user.id} defaultName={name} initialRole={finishing ? "pro" : sp.role === "pro" ? "pro" : sp.role === "client" ? "client" : null} blocked={blocked && !finishing} finishing={finishing} />
      </div>
    </main>
  );
}
