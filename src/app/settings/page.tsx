import Link from "next/link";
import { redirect } from "next/navigation";
import { accountLabel } from "@/lib/account";
import { getMe } from "@/lib/supabase/server";
import Settings from "./Settings";
import { posterOf } from "@/lib/reels";

export default async function SettingsPage() {
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup");
  if (!profile) redirect("/onboarding");
  const label = await accountLabel(supabase, profile);
  let photos: string[] = [];
  if (profile.role === "pro") {
    const { data } = await supabase.from("pros").select("*").eq("id", user.id).maybeSingle();
    const videos = ((data?.videos as string[] | undefined) ?? []);
    // Uploaded videos and their cover images go with the creator profile too.
    photos = [...((data?.photos as string[] | undefined) ?? []), ...videos, ...videos.map(posterOf)];
  }
  const { data: cars } = await supabase.from("cars").select("photos").eq("owner_id", user.id);
  const carPhotos = ((cars ?? []) as { photos: string[] | null }[]).flatMap((c) => c.photos ?? []);
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>Settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {profile.role === "pro" ? <Link href="/pro/edit">Edit your public profile</Link> : <><Link href="/shoots">Your shoots</Link> · <Link href="/me">Your garage</Link></>}
      </p>
      <Settings userId={user.id} email={user.email ?? ""} name={profile.name} role={profile.role} label={label ?? ""} photos={photos} avatar={profile.avatar ?? null} carPhotos={carPhotos} />
    </main>
  );
}
