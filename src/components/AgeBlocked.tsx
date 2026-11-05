"use client";
import { useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MIN_AGE } from "@/lib/legal";

/**
 * Shown to someone who gave a birth date under the minimum age. If they're signed in to an
 * account that never got a profile, that sign-in is deleted so no email is kept for them.
 */
export default function AgeBlocked({ signedIn = false }: { signedIn?: boolean }) {
  useEffect(() => {
    if (!signedIn) return;
    const supabase = createClient();
    supabase.rpc("delete_my_account").then(() => supabase.auth.signOut(), () => supabase.auth.signOut());
  }, [signedIn]);
  return (
    <div className="card" role="alert">
      <h3>Sorry, you can&apos;t use Rollshot yet</h3>
      <p className="muted">Rollshot is only for people {MIN_AGE} and older. We didn&apos;t keep any of your details.</p>
      <p className="small muted"><Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p>
    </div>
  );
}
