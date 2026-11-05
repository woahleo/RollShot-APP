import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { pushReady } from "@/lib/push";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Alert = { subs?: Sub[]; title?: string; body?: string | null; href?: string | null; tag?: string | null };

/**
 * The database calls this for each notification (see 0019_admin_notifications.sql). It signs the
 * alert with the app's push keys and hands it to Apple, Google or Mozilla, which wake the phone.
 */
export async function POST(req: Request) {
  const secret = process.env.PUSH_SECRET;
  if (!pushReady() || !secret || req.headers.get("x-push-secret") !== secret) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }
  const a = (await req.json().catch(() => ({}))) as Alert;
  if (!a.title || !Array.isArray(a.subs)) return Response.json({ error: "Nothing to send" }, { status: 400 });
  webpush.setVapidDetails(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://roll-shot-app.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const payload = JSON.stringify({ title: a.title, body: a.body ?? "", href: a.href ?? "/", tag: a.tag ?? undefined });
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    a.subs.slice(0, 20).map(async (s) => {
      try {
        await webpush.sendNotification(s, payload, { TTL: 60 * 60 * 24, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint); // switched off or uninstalled
      }
    }),
  );
  if (dead.length) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    await sb.rpc("drop_dead_push", { p_secret: secret, p_endpoints: dead });
  }
  return Response.json({ sent, dropped: dead.length });
}
