import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · Rollshot" };

/** Plain-language privacy policy. Meta asks for one (and for data deletion steps) before Instagram connect goes live. */
export default function Privacy() {
  return (
    <main className="wrap prose" style={{ maxWidth: 720 }}>
      <h1>Privacy<em>.</em></h1>
      <p className="muted">Last updated November 3, 2026</p>

      <h2>What Rollshot keeps</h2>
      <p>
        Your email address, your name, your profile picture, and what you add yourself: cars, photos, packages, open days, bookings,
        requests and messages. Creators&apos; contact details are only shown to a car owner after a shoot is confirmed.
      </p>

      <h2>Instagram</h2>
      <p>
        If you&apos;re a creator and connect Instagram, Rollshot gets read-only access to your profile name and your posts through
        Instagram&apos;s official login. We use it only to show you your posts so you can pick which videos to show on your page and which
        photos to copy into your portfolio. Rollshot never posts, comments, messages or follows for you, and never shows your whole feed.
      </p>
      <p>
        We store the Instagram login token so the picker works next time. It&apos;s kept on our servers, never shown on any page, and
        deleted when you disconnect. Photos you choose to import are copied into your Rollshot portfolio, and videos you pick are saved as
        links that play in Instagram&apos;s own player.
      </p>

      <h2>Who sees what</h2>
      <p>
        Creator pages, posted shoots and shared car pages are public. A car owner&apos;s profile (name, picture and shared cars) is only
        visible to creators. We don&apos;t sell your data or show ads. We use Supabase to store data and Vercel to run the site.
      </p>

      <h2 id="delete">Deleting your data</h2>
      <p>
        To remove Instagram access, open <Link href="/pro/instagram">Instagram</Link> from your dashboard and tap Disconnect. You can also remove
        Rollshot in Instagram under Settings, then Website permissions, then Apps and websites.
      </p>
      <p>
        To delete everything, go to <Link href="/settings">Settings</Link> and tap Delete account. Your account, photos, cars, bookings,
        messages and Instagram connection are removed right away. If you can&apos;t sign in, email us from the address on your account and we
        delete it for you.
      </p>
    </main>
  );
}
