import { LEGAL } from "@/lib/legal";

/** How to reach Rollshot about legal, privacy or copyright matters, from the details set in Vercel. */
export default function LegalContact({ subject }: { subject: string }) {
  return (
    <address className="legal-contact">
      {LEGAL.agent && <span>{LEGAL.agent}</span>}
      <span>{LEGAL.name}</span>
      {LEGAL.address && <span>{LEGAL.address}</span>}
      {LEGAL.email ? (
        <a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(subject)}`}>{LEGAL.email}</a>
      ) : (
        <span className="muted">Contact email coming soon</span>
      )}
    </address>
  );
}
