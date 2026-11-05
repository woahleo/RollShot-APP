export const MAX_REELS = 6;

/**
 * Turns whatever someone pastes (a reel, post or IGTV link, with or without tracking bits) into the
 * clean link Rollshot stores, like https://www.instagram.com/reel/ABC123/. Returns null for anything else.
 */
export function cleanReelLink(input: string): string | null {
  const s = input.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?instagram\.com$/i.test(u.hostname)) return null;
  // Profile links look like /username/reel/CODE/ on some share sheets, so take the last match.
  const m = u.pathname.match(/\/(reels?|p|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
  if (!m) return null;
  const kind = m[1].startsWith("reel") ? "reel" : m[1];
  return `https://www.instagram.com/${kind}/${m[2]}/`;
}

/** Uploaded videos are stored up to this size. Supabase's free plan stops at 50 MB per file. */
export const MAX_VIDEO_MB = 50;

/** An uploaded video's cover image sits next to it with the same name. */
export const posterOf = (path: string) => path.replace(/\.[^./]+$/, "") + ".jpg";
