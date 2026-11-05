/** The iPhone app adds this to its user agent (see capacitor.config.ts). */
export const APP_UA = "RollshotApp";

/** True inside the Rollshot iPhone app, on the server (pass the user agent) or in the browser. */
export function isApp(userAgent?: string | null) {
  if (userAgent !== undefined) return !!userAgent?.includes(APP_UA);
  if (typeof window === "undefined") return false;
  return navigator.userAgent.includes(APP_UA) || !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

/**
 * The account Apple's reviewers sign in with. It's the only account with a password: typing this
 * email on the sign-in page shows a password box instead of sending a link.
 */
export const REVIEW_EMAIL = "applereview@rollshot.app";
