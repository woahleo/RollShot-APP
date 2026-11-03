import Link from "next/link";
import { redirect } from "next/navigation";
import { accountLabel } from "@/lib/account";
import { getMe } from "@/lib/supabase/server";
import Settings from "./Settings";

export default async function SettingsPage() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (!profile) redirect("/onboarding");
  const label = await accountLabel(supabase, profile);
  let photos: string[] = [];
  if (profile.role === "pro") {
    const { data } = await supabase.from("pros").select("photos").eq("id", user.id).maybeSingle();
    photos = (data?.photos as string[] | undefined) ?? [];
  }
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>Settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {profile.role === "pro" ? <Link href="/pro/edit">Edit your public profile</Link> : <Link href="/me">Your garage and shoots</Link>}
      </p>
      <Settings userId={user.id} email={user.email ?? ""} name={profile.name} role={profile.role} label={label ?? ""} photos={photos} />
    </main>
  );
}
