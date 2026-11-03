import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";
import type { Booking, ShootPost } from "@/lib/types";
import { prettyDate } from "@/lib/sun";
import PostShoot from "./PostShoot";

export default async function PostShootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await getMe();
  if (!user) redirect(`/signup?next=/pro/post/${id}`);
  if (profile?.role !== "pro") redirect("/me");
  const [{ data: b }, { data: existing }] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
    supabase.from("shoot_posts").select("*").eq("booking_id", id).maybeSingle(),
  ]);
  const booking = b as Booking | null;
  if (!booking || booking.pro_id !== user.id) notFound();
  const post = existing as ShootPost | null;

  return (
    <main className="wrap" style={{ maxWidth: 680 }}>
      <p className="eyebrow">{booking.package_name} · {prettyDate(booking.shoot_date)} · ${booking.price}</p>
      <h1 style={{ marginBottom: 6 }}>{post ? "Edit this post" : "Post this shoot"}<em>.</em></h1>
      <p className="lede">{booking.car ?? "This car"}. The photos go on your page, on the car&apos;s page, and anyone who sees them can book you from there.</p>
      <PostShoot userId={user.id} bookingId={booking.id} post={post} />
    </main>
  );
}
