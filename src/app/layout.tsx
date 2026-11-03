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

export const metadata: Metadata = {
  title: "Rollshot",
  description: "Book car photographers and videographers in South Florida.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem("rs-theme");if(t)document.documentElement.dataset.rs=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getMe();
  const label = await accountLabel(supabase, profile);
  // Two or three links at most; everything else lives in the account menu.
  const links =
    profile?.role === "pro"
      ? [{ href: "/requests", label: "Requests" }, { href: "/pro", label: "Dashboard" }]
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
            <Link href={profile?.role === "pro" ? "/pro" : "/"} className="logo">Rollshot</Link>
            <NavLinks links={links} />
            <div className="top-right">
              {user ? (
                <AccountMenu name={profile?.name ?? ""} label={label ?? ""} />
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
