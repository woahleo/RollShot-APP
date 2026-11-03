import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import { igReady } from "@/lib/instagram";
import { proPath } from "@/lib/types";
import InstagramPicker from "./InstagramPicker";

const ERRORS: Record<string, string> = {
  denied: "Instagram connect was cancelled. You can try again any time.",
  state: "That login link expired. Tap Connect Instagram again.",
  exchange: "Instagram didn't finish the login. Make sure it's a Business or Creator account, then try again.",
  setup: "Instagram connect isn't switched on yet. You can still paste reel links on your dashboard.",
};

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const { error, connected } = await searchParams;
  const { supabase, user, profile } = await getMe();
  if (!user) redirect("/signup?next=/pro/instagram");
  if (profile?.role !== "pro") redirect("/");
  const [{ data: link }, { data: pro }] = await Promise.all([
    supabase.from("instagram_links").select("username, connected_at").eq("pro_id", user.id).maybeSingle(),
    supabase.from("pros").select("handle, reels, photos").eq("id", user.id).single(),
  ]);
  const p = pro as { handle: string | null; reels: string[] | null; photos: string[] };
  const ig = link as { username: string | null; connected_at: string } | null;

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <p className="eyebrow"><Link href="/pro">Dashboard</Link></p>
      <h1 style={{ marginBottom: 6 }}>Instagram<em>.</em></h1>
      <p className="lede">Pick the videos and photos from your Instagram that show your best car work. Only what you pick shows on Rollshot, never your whole feed.</p>
      {error && ERRORS[error] && <p className="notice">{ERRORS[error]}</p>}
      {connected && ig && <p className="notice">Connected{ig.username ? ` as @${ig.username}` : ""}. Now pick what to show.</p>}

      {ig ? (
        <InstagramPicker userId={user.id} username={ig.username} reels={p.reels ?? []} pageHref={proPath({ id: user.id, handle: p.handle })} />
      ) : igReady() ? (
        <div className="card ig-connect">
          <h3 style={{ margin: 0 }}>Connect your Instagram</h3>
          <p className="small muted" style={{ margin: 0 }}>
            You log in on Instagram and Rollshot gets read-only access to your posts. Rollshot never posts, comments or messages for you, and you can disconnect any time.
            It works with Business and Creator accounts, which you can switch to for free in Instagram under Settings, then Account type and tools.
          </p>
          <a className="btn solid" href="/api/instagram/connect">Connect Instagram</a>
        </div>
      ) : (
        <div className="card ig-connect">
          <h3 style={{ margin: 0 }}>Coming soon</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Connecting Instagram isn&apos;t switched on yet. For now, paste links to your reels under Your videos on your <Link href="/pro#videos">dashboard</Link>.
          </p>
        </div>
      )}
    </main>
  );
}
