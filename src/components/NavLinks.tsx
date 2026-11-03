"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The few main links for this account type. The current page is shown in full ink. */
export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(l.href + "/") ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
