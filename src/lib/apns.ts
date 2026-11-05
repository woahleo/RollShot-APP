import { connect } from "node:http2";
import { createSign } from "node:crypto";

/**
 * Sends alerts to the iPhone app through Apple's push service. Needs APNS_KEY (the .p8 file's text),
 * APNS_KEY_ID and APNS_TEAM_ID in Vercel. App phones are saved as "apns:<token>" push addresses.
 */
export const apnsReady = () => !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

const TOPIC = process.env.APNS_TOPIC ?? "com.rollshot.app";
let cached: { jwt: string; at: number } | null = null;

function b64url(x: Buffer | string) {
  return Buffer.from(x).toString("base64url");
}

/** Apple wants a fresh signed token at least every hour, and no more than every 20 minutes. */
function token() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && now - cached.at < 40 * 60) return cached.jwt;
  const head = b64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }));
  const body = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: now }));
  const key = process.env.APNS_KEY!.replace(/\\n/g, "\n");
  const sig = createSign("SHA256").update(`${head}.${body}`).sign({ key, dsaEncoding: "ieee-p1363" });
  cached = { jwt: `${head}.${body}.${b64url(sig)}`, at: now };
  return cached.jwt;
}

type Result = { ok: boolean; status: number; reason?: string };

function post(host: string, device: string, payload: string, collapse?: string): Promise<Result> {
  return new Promise((resolve) => {
    const client = connect(`https://${host}`);
    client.on("error", () => resolve({ ok: false, status: 0, reason: "connect" }));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${device}`,
      authorization: `bearer ${token()}`,
      "apns-topic": TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 3600),
      ...(collapse ? { "apns-collapse-id": collapse.slice(0, 64) } : {}),
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => { status = Number(h[":status"]); });
    req.setEncoding("utf8");
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      client.close();
      let reason: string | undefined;
      try { reason = JSON.parse(data).reason; } catch {}
      resolve({ ok: status === 200, status, reason });
    });
    req.on("error", () => { client.close(); resolve({ ok: false, status: 0, reason: "request" }); });
    req.end(payload);
  });
}

/**
 * Send one alert to one app install. Builds from Xcode use Apple's sandbox, App Store and TestFlight
 * builds use production, so a token production doesn't know is tried on the sandbox too.
 * Returns "sent", "dead" (the app was removed or alerts turned off) or "failed".
 */
export async function sendApns(device: string, a: { title: string; body?: string | null; href?: string | null; tag?: string | null }) {
  const payload = JSON.stringify({ aps: { alert: { title: a.title, body: a.body ?? "" }, sound: "default" }, href: a.href ?? "/" });
  let r: Result;
  try {
    r = await post("api.push.apple.com", device, payload, a.tag ?? undefined);
    if (!r.ok && r.reason === "BadDeviceToken") r = await post("api.sandbox.push.apple.com", device, payload, a.tag ?? undefined);
  } catch (e) {
    console.error("apns: couldn't sign or send (check APNS_KEY in Vercel)", (e as Error).message);
    return "failed";
  }
  if (r.ok) return "sent";
  if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered") return "dead";
  console.error("apns: send failed", r.status, r.reason);
  return "failed";
}
