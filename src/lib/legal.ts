/**
 * Who Rollshot is for, and how to reach the people behind it. The contact details come from
 * environment variables so they can be set in Vercel without a code change:
 *   NEXT_PUBLIC_LEGAL_EMAIL    where legal, privacy and copyright notices go
 *   NEXT_PUBLIC_LEGAL_ADDRESS  a mailing address (a PO box is fine), on one line
 *   NEXT_PUBLIC_DMCA_AGENT     the name registered as the DMCA agent at dmca.copyright.gov
 * The same minimum age is enforced in the database (supabase/migrations/0023_age_gate.sql).
 */
export const MIN_AGE = 13;

export const LEGAL = {
  name: "Rollshot",
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() ?? "",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() ?? "",
  agent: process.env.NEXT_PUBLIC_DMCA_AGENT?.trim() ?? "",
  state: "Florida",
  updated: "November 5, 2026",
};

/** Whole years between a birth date (YYYY-MM-DD) and today, or null if it isn't a real past date. */
export function ageOn(birth: string, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1900 || date > today) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age;
}

/** Set on this browser when someone gives a birth date under MIN_AGE, so going back and changing it doesn't work. */
export const AGE_BLOCK_COOKIE = "rs_age_block";
