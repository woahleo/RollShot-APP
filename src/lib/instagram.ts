import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Instagram API with Instagram Login (Business or Creator accounts). The app id and secret come from
 * the Meta app's Instagram settings. The base URLs can be pointed at a stand-in server for tests.
 */
export const IG = {
  appId: process.env.INSTAGRAM_APP_ID ?? "",
  secret: process.env.INSTAGRAM_APP_SECRET ?? "",
  authUrl: process.env.INSTAGRAM_AUTH_URL ?? "https://www.instagram.com",
  oauthUrl: process.env.INSTAGRAM_OAUTH_URL ?? "https://api.instagram.com",
  graphUrl: process.env.INSTAGRAM_GRAPH_URL ?? "https://graph.instagram.com",
  scope: "instagram_business_basic",
};
export const igReady = () => !!(IG.appId && IG.secret);
export const STATE_COOKIE = "ig_state";

export type IgMedia = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp?: string;
  children?: { data: { id: string; media_type: string; media_url?: string }[] };
};

/** Where Instagram sends people back to. It has to match the redirect URI saved in the Meta app exactly. */
export function redirectUri(origin: string) {
  return `${process.env.INSTAGRAM_REDIRECT_BASE ?? origin}/api/instagram/callback`;
}

async function igJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    const msg = body?.error?.message ?? body?.error_message ?? `Instagram said ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

/** The one-time code from the login turns into a short token, then a 60-day token. */
export async function exchangeCode(code: string, origin: string) {
  const form = new URLSearchParams({
    client_id: IG.appId,
    client_secret: IG.secret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(origin),
    code: code.replace(/#_$/, ""),
  });
  const short = await igJson<{ access_token?: string; user_id?: string | number; data?: { access_token: string; user_id: string | number }[] }>(
    await fetch(`${IG.oauthUrl}/oauth/access_token`, { method: "POST", body: form, signal: AbortSignal.timeout(10000) }),
  );
  const s = short.data?.[0] ?? short;
  if (!s.access_token) throw new Error("Instagram didn't send a token");
  const long = await igJson<{ access_token: string; expires_in?: number }>(
    await fetch(`${IG.graphUrl}/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: IG.secret, access_token: s.access_token })}`, { signal: AbortSignal.timeout(10000) }),
  );
  const me = await igJson<{ user_id?: string; id?: string; username?: string }>(
    await fetch(`${IG.graphUrl}/me?${new URLSearchParams({ fields: "user_id,username", access_token: long.access_token })}`, { signal: AbortSignal.timeout(10000) }),
  );
  return {
    token: long.access_token,
    expires: new Date(Date.now() + (long.expires_in ?? 60 * 86400) * 1000).toISOString(),
    igUserId: String(me.user_id ?? me.id ?? s.user_id ?? ""),
    username: me.username ?? null,
  };
}

/**
 * The creator's token, refreshed when it is more than a day old and has under 30 days left
 * (tokens last 60 days and can only be refreshed while still valid). Null when not connected.
 */
export async function tokenFor(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.rpc("my_instagram_token");
  const row = (data as { token: string; token_expires: string | null; token_refreshed: string }[] | null)?.[0];
  if (!row) return null;
  const left = row.token_expires ? new Date(row.token_expires).getTime() - Date.now() : Infinity;
  const age = Date.now() - new Date(row.token_refreshed).getTime();
  if (left > 0 && left < 30 * 86400e3 && age > 86400e3) {
    try {
      const r = await igJson<{ access_token: string; expires_in?: number }>(
        await fetch(`${IG.graphUrl}/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: row.token })}`, { signal: AbortSignal.timeout(8000) }),
      );
      await supabase.rpc("refresh_instagram_token", { p_token: r.access_token, p_expires: new Date(Date.now() + (r.expires_in ?? 60 * 86400) * 1000).toISOString() });
      return r.access_token;
    } catch {
      // Keep using the current token; it still works until it expires.
    }
  }
  return row.token;
}

const FIELDS = "id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp,children{id,media_type,media_url}";

/** One page of the creator's own posts, newest first. */
export async function listMedia(token: string, after?: string | null) {
  const q = new URLSearchParams({ fields: FIELDS, limit: "24", access_token: token });
  if (after) q.set("after", after);
  const page = await igJson<{ data: IgMedia[]; paging?: { cursors?: { after?: string }; next?: string } }>(
    await fetch(`${IG.graphUrl}/me/media?${q}`, { signal: AbortSignal.timeout(10000), cache: "no-store" }),
  );
  return { items: page.data ?? [], after: page.paging?.next ? page.paging.cursors?.after ?? null : null };
}

/** One post by id, read with the creator's own token, so it can only be one of theirs. */
export async function getMedia(token: string, id: string) {
  return igJson<IgMedia>(
    await fetch(`${IG.graphUrl}/${encodeURIComponent(id)}?${new URLSearchParams({ fields: FIELDS, access_token: token })}`, { signal: AbortSignal.timeout(10000), cache: "no-store" }),
  );
}

/** The photos inside a post: the post itself, or each photo of a carousel. Videos are left out. */
export function photosOf(m: IgMedia): { id: string; url: string }[] {
  if (m.media_type === "IMAGE" && m.media_url) return [{ id: m.id, url: m.media_url }];
  if (m.media_type === "CAROUSEL_ALBUM") {
    return (m.children?.data ?? []).filter((c) => c.media_type === "IMAGE" && c.media_url).map((c) => ({ id: c.id, url: c.media_url! }));
  }
  return [];
}
