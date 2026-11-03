import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import ChatBubble from "@/components/ChatBubble";
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
  return (
    <html lang="en" data-rs="light" className={outfit.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo">Rollshot</Link>
            <nav className="nav">
              {profile?.role !== "pro" && <Link href="/book">Find a photographer</Link>}
              {profile?.role === "pro" && <Link href="/pro">Dashboard</Link>}
              {profile?.role === "client" && <Link href="/me">My garage</Link>}
              {user && <Link href="/messages">Messages</Link>}
              {label && <span className="badge">{label}</span>}
              {!user && <Link href="/signup">Sign up</Link>}
              {user && <Link href="/settings">Settings</Link>}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
        {user && <ChatBubble userId={user.id} />}
      </body>
    </html>
  );
}
