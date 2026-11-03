export type Role = "client" | "pro";
export type Kind = "photo" | "video" | "both";
export const KIND_LABEL: Record<Kind, string> = { photo: "Photographer", video: "Videographer", both: "Photo + video" };
export type Profile = { id: string; role: Role; name: string; created_at: string };
export type Car = { id: string; owner_id: string; year: string | null; make: string | null; model: string | null; color: string | null; mods: string | null };
export type Pro = {
  id: string; city: string; kind: Kind; about: string | null;
  shoot_types: string[]; open_dates: string[]; photos: string[];
};
export type Package = { id: string; pro_id: string; name: string; price: number; position: number };
export type BookingStatus = "requested" | "confirmed" | "declined" | "rescheduled" | "cancelled";
export type Booking = {
  id: string; pro_id: string; client_id: string; package_name: string; price: number;
  shoot_date: string; car: string | null; status: BookingStatus; rain_from: string | null; created_at: string;
  late_cancel?: boolean; cancelled_by?: string | null;
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

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/${path}`;
}

export type ShootPost = {
  id: string; booking_id: string; pro_id: string; owner_id: string; car_id: string | null;
  car: string; city: string; shoot_type: string; price: number; shoot_date: string;
  caption: string | null; photos: string[]; video_url: string | null;
  hidden_by_owner: boolean; created_at: string;
};
