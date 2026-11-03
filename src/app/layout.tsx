import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import ChatBubble from "@/components/ChatBubble";
import NavLinks from "@/components/NavLinks";
import AccountMenu from "@/components/AccountMenu";
import { getMe } from "@/lib/supabase/server";
import { accountLabel } from "@/lib/account";

const outfit = Outfit({ subsets: ["latin"], weight: ["200", "300", "400", "500"], variable: "--font-outfit" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://roll-shot-app.vercel.app");
const DESCRIPTION = "Book car photographers and videographers in South Florida. Real portfolios, real open dates, no back and forth.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Rollshot",
  description: DESCRIPTION,
  openGraph: { siteName: "Rollshot", type: "website", title: "Rollshot · Your car, shot right.", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Rollshot · Your car, shot right.", description: DESCRIPTION },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem("rs-theme");if(t)document.documentElement.dataset.rs=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getMe();
  const label = await accountLabel(supabase, profile);
  // Two or three links at most; everything else lives in the account menu.
  const links =
    profile?.role === "pro"
      ? [{ href: "/requests", label: "Requests" }, { href: "/crew", label: "Crew" }, { href: "/pro", label: "Dashboard" }]
      : profile?.role === "client"
        ? [{ href: "/book", label: "Photographers" }, { href: "/requests", label: "Requests" }, { href: "/shoots", label: "Shoots" }, { href: "/me", label: "Garage" }]
        : [{ href: "/book", label: "Photographers" }, { href: "/requests", label: "Requests" }];
  return (
    <html lang="en" data-rs="light" className={outfit.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo" aria-label="Rollshot home">Rollshot</Link>
            <NavLinks links={links} />
            <div className="top-right">
              {user ? (
                <AccountMenu name={profile?.name ?? ""} label={label ?? ""} avatar={profile?.avatar} />
              ) : (
                <>
                  <ThemeToggle />
                  <Link href="/signup" className="btn solid small">Sign in</Link>
                </>
              )}
            </div>
          </div>
        </header>
        {children}
        {user && <ChatBubble userId={user.id} />}
      </body>
    </html>
  );
}
