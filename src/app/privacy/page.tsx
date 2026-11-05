import type { Metadata } from "next";
import Link from "next/link";
import LegalContact from "@/components/LegalContact";
import { LEGAL, MIN_AGE } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy · Rollshot", description: "What Rollshot collects, who sees it, and how to delete it." };

export default function Privacy() {
  return (
    <main className="wrap legal">
      <h1>Privacy Policy</h1>
      <p className="muted small">Last updated {LEGAL.updated}</p>
      <p>This explains what {LEGAL.name} collects, why, who can see it, and how to delete it. We don&apos;t sell your information, we don&apos;t show ads, and we don&apos;t use analytics, tracking pixels or session recording.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> your email, name, and whether you own a car or shoot cars. If you sign in with Google or Apple, we get your name and email from them.</li>
        <li><b>Age check:</b> when you sign up we ask your date of birth to make sure you&apos;re at least {MIN_AGE}. We don&apos;t save the date, only that the check passed.</li>
        <li><b>Creator profile:</b> your photo, city, bio, what you shoot, packages and prices, portfolio photos, Instagram reel links, open dates and username.</li>
        <li><b>Contact details:</b> the Instagram handle and phone number creators choose to add.</li>
        <li><b>Garage:</b> your cars and car photos, if you add them.</li>
        <li><b>Activity:</b> requests, offers, bookings, crew jobs, messages and notifications.</li>
        <li><b>Push notifications:</b> if you turn them on, an address from your browser&apos;s push service so we can reach this device.</li>
        <li><b>Technical:</b> sign-in cookies that keep you signed in, your light or dark theme choice (saved only in your browser), and standard server logs such as IP address and browser type, kept by our hosting providers for security.</li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li><b>Everyone:</b> creator profiles, portfolio photos, packages, prices and open dates, finished shoot posts, open requests on the requests board, and cars in your garage marked Shared (you can switch any car to Private in your garage).</li>
        <li><b>People you deal with:</b> messages are seen only by the two people in the chat. A creator&apos;s phone number and Instagram are shown only to clients with a confirmed shoot.</li>
        <li><b>Rollshot:</b> the people who run Rollshot can access the database to run the site, keep people safe and answer legal requests.</li>
      </ul>

      <h2>Services we use</h2>
      <p>These companies process data for us only to run Rollshot:</p>
      <ul>
        <li><b>Supabase:</b> database, sign-in, sign-in emails and photo storage.</li>
        <li><b>Vercel:</b> hosting the website.</li>
        <li><b>Google or Apple:</b> only if you choose to sign in with them.</li>
        <li><b>Browser push services</b> (Apple, Google, Mozilla): deliver push notifications you turn on. The message is encrypted on the way.</li>
        <li><b>Instagram:</b> reels on creator pages play in Instagram&apos;s own player, which loads from Instagram and follows <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noreferrer">Instagram&apos;s privacy policy</a>.</li>
        <li><b>Google Calendar:</b> only if you tap &quot;Add to Google Calendar&quot; on a shoot.</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect someone&apos;s safety.</p>

      <h2>Emails and notifications</h2>
      <p>We only email you sign-in links. We don&apos;t send marketing emails. In-app and push notifications are about your own shoots, requests and messages, and you can turn push off at any time on the <Link href="/notifications">Notifications</Link> page or in your browser settings.</p>

      <h2>Keeping and deleting your data</h2>
      <p>We keep your information while your account is open. You can delete your account at any time in <Link href="/settings">Settings</Link>. That removes your profile, photos, garage, packages, requests, bookings and messages right away. Copies in our providers&apos; backups are erased on their normal schedule, usually within a few weeks.</p>

      <h2>Your choices</h2>
      <p>You can see and edit most of your information in the app. To ask for a copy of your data, a correction, or deletion, email us. Depending on where you live (for example California, Virginia, Colorado or Texas), you may have these rights by law, and we honor them for everyone.</p>

      <h2>Teens and children</h2>
      <p>Rollshot is not for children under {MIN_AGE}, and we don&apos;t knowingly collect information from them. If we learn we have, we delete it. If you are 13 to 17, please use Rollshot with a parent&apos;s permission and never meet anyone for a shoot without a parent knowing. Parents can email us to review or delete their teen&apos;s account.</p>

      <h2>Security</h2>
      <p>Data is sent over encrypted connections, and database rules limit each person to their own private information. No system is perfectly secure, so please use a sign-in email that only you can access.</p>

      <h2>Changes</h2>
      <p>If we change this policy in an important way, we&apos;ll tell you on the site before it applies.</p>

      <h2>Contact</h2>
      <LegalContact subject="Rollshot privacy" />
      <p className="small muted">See also the <Link href="/terms">Terms of Service</Link>.</p>
    </main>
  );
}
