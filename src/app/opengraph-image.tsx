import { ogCard, OG_SIZE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Rollshot: book car photographers and videographers in South Florida";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard();
}
