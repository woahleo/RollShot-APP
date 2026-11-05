import type { Metadata } from "next";
import Link from "next/link";
import LegalContact from "@/components/LegalContact";
import { LEGAL, MIN_AGE } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms · Rollshot", description: "The rules for using Rollshot." };

export default function Terms() {
  return (
    <main className="wrap legal">
      <h1>Terms of Service</h1>
      <p className="muted small">Last updated {LEGAL.updated}</p>
      <p>These terms are an agreement between you and {LEGAL.name}. By making an account or using the site, you agree to them. If you don&apos;t agree, please don&apos;t use Rollshot.</p>

      <h2>Who can use Rollshot</h2>
      <p>You must be at least {MIN_AGE} years old. If you are under 18, you may only use Rollshot with permission from a parent or guardian, and they agree to these terms for you. Please don&apos;t lie about your age. If we learn an account belongs to someone under {MIN_AGE}, we delete it.</p>

      <h2>What Rollshot is</h2>
      <p>Rollshot helps car owners find car photographers and videographers (&quot;creators&quot;), and helps creators find crew. We are not a party to any shoot. Creators are independent and are not our employees or agents. Any price, date or plan is agreed between the two of you, and you pay each other directly. We don&apos;t check anyone&apos;s background, licenses, insurance or skills, and we don&apos;t guarantee any shoot, result or payment.</p>

      <h2>Staying safe on shoots</h2>
      <ul>
        <li>Meet in public places, tell someone where you&apos;re going, and trust your gut.</li>
        <li>Obey all traffic laws. Rolling shots and car-to-car filming must be done legally and safely, with a sober driver whose only job is driving. Never film while you drive.</li>
        <li>Get permission for private property, and any permits a location needs.</li>
        <li>You take part in shoots at your own risk, and you are responsible for your car, your gear and your own conduct.</li>
      </ul>

      <h2>Your account</h2>
      <p>Keep your sign-in to yourself. You are responsible for what happens on your account. Give true information about yourself, your car and your work. You can delete your account at any time in <Link href="/settings">Settings</Link>.</p>

      <h2>Your content</h2>
      <p>You keep ownership of the photos, videos, words and links you post. You give {LEGAL.name} a free, worldwide, non-exclusive license to host, show, resize and share that content on Rollshot and in links to it (like preview cards), for as long as it&apos;s on the site. Only post content you have the right to post. Creators and car owners should agree between themselves who may use photos from a shoot, and how.</p>

      <h2>What&apos;s not allowed</h2>
      <ul>
        <li>Harassment, threats, hate, or sexual content.</li>
        <li>Scams, fake profiles, fake reviews or misleading prices.</li>
        <li>Posting someone else&apos;s photos or videos as your own.</li>
        <li>Planning or showing street racing, stunts on public roads, or other illegal driving.</li>
        <li>Sharing someone&apos;s phone number or other private details outside the shoot it was shared for.</li>
        <li>Scraping the site, breaking its security, or using it to send spam.</li>
      </ul>
      <p>We may remove content or suspend or close accounts that break these rules, or to keep people safe, with or without notice.</p>

      <h2>Copyright</h2>
      <p>If you think something on Rollshot infringes your copyright, see our <Link href="/copyright">copyright policy</Link>. We close the accounts of repeat infringers.</p>

      <h2>No warranties</h2>
      <p>Rollshot is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, to the fullest extent the law allows. We don&apos;t promise the site will always work or be error-free.</p>

      <h2>Limits on our liability</h2>
      <p>To the fullest extent the law allows, {LEGAL.name} is not liable for anything that happens between users, at a shoot, or on the road, including injury, damage to cars or gear, lost payments, or lost data. If we are found liable for anything, our total liability is limited to $100.</p>
      <p>You agree to cover {LEGAL.name}&apos;s costs from claims caused by your content, your shoots, or your breaking these terms.</p>

      <h2>Changes and the law that applies</h2>
      <p>We may update these terms. If the changes are important, we&apos;ll tell you on the site before they apply. These terms are governed by the laws of {LEGAL.state} and the United States.</p>

      <h2>Contact</h2>
      <LegalContact subject="Rollshot terms" />
      <p className="small muted">See also the <Link href="/privacy">Privacy Policy</Link>.</p>
    </main>
  );
}
