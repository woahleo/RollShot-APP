import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import ChatBubble from "@/components/ChatBubble";
import { getMe } from "@/lib/supabase/server";

const outfit = Outfit({ subsets: ["latin"], weight: ["200", "300", "400", "500"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Rollshot",
  description: "Book car photographers and videographers in South Florida.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem("rs-theme");if(t)document.documentElement.dataset.rs=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getMe();
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
              <Link href="/book">Find a shooter</Link>
              {profile?.role === "pro" && <Link href="/pro">Dashboard</Link>}
              {profile?.role === "client" && <Link href="/me">My shoots</Link>}
              {user && <Link href="/messages">Messages</Link>}
              {!user && <Link href="/signup">Sign up</Link>}
              {user && (
                <form action="/auth/signout" method="post">
                  <button className="btn small" type="submit">Sign out</button>
                </form>
              )}
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
