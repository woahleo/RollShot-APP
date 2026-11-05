import webpush from "web-push";
import { getMe } from "@/lib/supabase/server";
import { pushReady } from "@/lib/push";
import { apnsReady, sendApns } from "@/lib/apns";

/** Admin page button: sends a test alert to the admin's own devices, straight from the app. */
export async function POST() {
  const { supabase, user } = await getMe();
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const { data: ok } = await supabase.rpc("is_admin");
  if (ok !== true) return Response.json({ error: "Not allowed" }, { status: 403 });
  if (!pushReady() && !apnsReady()) return Response.json({ error: "Add the Vercel settings first" }, { status: 400 });
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id);
  if (pushReady()) webpush.setVapidDetails(process.env.NEXT_PUBLIC_SITE_URL ?? "https://roll-shot-app.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const payload = JSON.stringify({ title: "Rollshot test", body: "Phone alerts are working.", href: "/notifications", tag: "test" });
  let sent = 0;
  const errors: string[] = [];
  for (const s of subs ?? []) {
    if (s.endpoint.startsWith("apns:")) {
      if (!apnsReady()) { errors.push("the iPhone app's push key isn't set in Vercel yet"); continue; }
      const r = await sendApns(s.endpoint.slice(5), { title: "Rollshot test", body: "Phone alerts are working.", href: "/notifications", tag: "test" });
      if (r === "sent") sent++;
      else errors.push(r === "dead" ? "this iPhone turned alerts off" : "Apple didn't accept it");
      continue;
    }
    if (!pushReady()) continue;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600 });
      sent++;
    } catch (e) {
      errors.push(String((e as { body?: string; message?: string }).body ?? (e as Error).message));
    }
  }
  if (!sent && errors.length) return Response.json({ error: `The push service said: ${errors[0].slice(0, 160)}` }, { status: 502 });
  return Response.json({ sent });
}
