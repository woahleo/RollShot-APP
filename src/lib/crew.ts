/** Crew jobs: one creator hiring another to help on a shoot. */
export const CREW_ROLES = ["Second shooter", "Photographer", "Videographer", "Drone", "Editor", "Assistant"] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export type Gig = {
  id: string; poster_id: string; target_id: string | null; role: CrewRole; city: string;
  shoot_date: string; shoot_time: string | null; pay: number; note: string | null;
  status: "open" | "filled" | "declined" | "closed"; hired_id: string | null; created_at: string;
};
export type GigReply = { gig_id: string; pro_id: string; note: string | null; status: "waiting" | "chosen" | "passed"; created_at: string };

/** What a role means, shown under the chips so nobody has to guess. */
export const ROLE_HINT: Record<CrewRole, string> = {
  "Second shooter": "Shoots alongside you",
  Photographer: "Takes the photos",
  Videographer: "Films the shoot",
  Drone: "Aerial shots",
  Editor: "Edits after the shoot",
  Assistant: "Lights, gear, driving",
};
