export type Role = "client" | "pro";
export type Kind = "photo" | "video" | "both";
export const KIND_LABEL: Record<Kind, string> = { photo: "Photo creator", video: "Video creator", both: "Photo + video creator" };
export type Profile = { id: string; role: Role; name: string; created_at: string; avatar?: string | null };
export type Car = { id: string; owner_id: string; year: string | null; make: string | null; model: string | null; color: string | null; mods: string | null; photos?: string[]; public?: boolean };
export type Pro = {
  id: string; city: string; kind: Kind; about: string | null; handle?: string | null;
  shoot_types: string[]; open_dates: string[]; photos: string[]; open_hours?: Record<string, string>; reels?: string[]; videos?: string[];
};
export type Package = { id: string; pro_id: string; name: string; price: number; position: number };
export type BookingStatus = "requested" | "confirmed" | "declined" | "rescheduled" | "cancelled";
export type Booking = {
  id: string; pro_id: string; client_id: string; package_name: string; price: number;
  shoot_date: string; car: string | null; status: BookingStatus; rain_from: string | null; created_at: string;
  late_cancel?: boolean; cancelled_by?: string | null; shoot_time?: string | null;
};
export type Thread = { id: string; pro_id: string; client_id: string; updated_at: string; unlimited: boolean };
export type Message = {
  id: string; thread_id: string; sender_id: string | null; kind: "text" | "system" | "offer";
  body: string; package_id: string | null; created_at: string;
  offer_name: string | null; offer_price: number | null; offer_dates: string[] | null; booking_id: string | null;
};

export const CITIES = ["West Palm Beach", "Boca Raton", "Fort Lauderdale", "Miami"] as const;
export const SHOOT_TYPES = ["Rolling shots", "Static", "Night", "Reels", "Track day", "Dealer stock"] as const;

export function carLabel(c: Partial<Car>) {
  return [c.year, c.color, c.make, c.model].filter(Boolean).join(" ");
}

/** A creator's public page: /p/their-name once they have a username, else their id. */
export function proPath(p: { id: string; handle?: string | null }) {
  return `/p/${p.handle || p.id}`;
}

/** /p/<key> takes a username or, for old links, an id. This says which column to look it up by. */
export function proKey(key: string): "id" | "handle" {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key) ? "id" : "handle";
}

/** Usernames: 3 to 30 lowercase letters, numbers or dashes, not starting or ending with a dash. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/${path}`;
}

export type ShootPost = {
  id: string; booking_id: string; pro_id: string; owner_id: string; car_id: string | null;
  car: string; city: string; shoot_type: string; price: number; shoot_date: string;
  caption: string | null; photos: string[]; video_url: string | null;
  hidden_by_owner: boolean; created_at: string;
};
