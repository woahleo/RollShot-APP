import type { Metadata } from "next";
import Link from "next/link";
import LegalContact from "@/components/LegalContact";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Copyright · Rollshot", description: "How to report copyright infringement on Rollshot (DMCA)." };

export default function Copyright() {
  return (
    <main className="wrap legal">
      <h1>Copyright policy</h1>
      <p className="muted small">Last updated {LEGAL.updated}</p>
      <p>Creators on Rollshot work hard on their photos and videos, so we take copyright seriously. We respond to notices under the Digital Millennium Copyright Act (DMCA).</p>

      <h2>Designated agent</h2>
      <p>Send copyright notices to our designated agent:</p>
      <LegalContact subject="DMCA notice" />

      <h2>Reporting infringement</h2>
      <p>If you believe something on Rollshot copies your work without permission, send a written notice that includes:</p>
      <ol>
        <li>Your physical or electronic signature.</li>
        <li>The work you believe was copied.</li>
        <li>The link to each page or photo on Rollshot you want removed.</li>
        <li>Your name, mailing address, phone number and email.</li>
        <li>A statement that you believe in good faith the use is not authorized by the owner, its agent, or the law.</li>
        <li>A statement that the information in your notice is accurate and, under penalty of perjury, that you are the owner or are authorized to act for the owner.</li>
      </ol>
      <p>We&apos;ll remove or disable the content and let the person who posted it know. Knowingly false notices can make you liable for damages.</p>

      <h2>Counter-notices</h2>
      <p>If your content was removed and you believe that was a mistake, you can send a counter-notice to the same agent with:</p>
      <ol>
        <li>Your physical or electronic signature.</li>
        <li>What was removed and where it was before.</li>
        <li>A statement under penalty of perjury that you believe in good faith it was removed by mistake or misidentification.</li>
        <li>Your name, address and phone number, and a statement that you consent to the jurisdiction of the federal court for your address (or, outside the US, any district where {LEGAL.name} can be found), and that you will accept service from the person who sent the notice.</li>
      </ol>
      <p>We&apos;ll send it to the person who filed the notice. Unless they tell us within 10 business days that they have gone to court, we may put the content back within 10 to 14 business days.</p>

      <h2>Repeat infringers</h2>
      <p>We close the accounts of people who repeatedly post work that infringes others&apos; copyrights.</p>
      <p className="small muted">See also the <Link href="/terms">Terms of Service</Link>.</p>
    </main>
  );
}
