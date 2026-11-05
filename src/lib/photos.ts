/**
 * Encode a canvas as WebP, or as JPEG where the browser can't make WebP (Safari hands back a
 * multi-megabyte PNG instead, which is what was filling up storage). Either way it's a few hundred KB.
 */
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const as = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
  return as("image/webp").then(async (b) => {
    if (b?.type === "image/webp") return b;
    const jpeg = await as("image/jpeg");
    if (!jpeg) throw new Error("Could not read that image");
    return jpeg;
  });
}

/** File extension and content type to store an encoded photo under. */
export const photoExt = (b: Blob) => (b.type === "image/webp" ? "webp" : "jpg");

/** Longest side of a stored photo. Big enough for a full-screen phone or laptop view. */
const MAX_SIDE = 1800;

/** Shrinks a photo to at most 1800px on the long side, as WebP or JPEG (about 250 to 500 KB). */
export async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return encode(canvas, 0.8);
}

/** A square profile picture: center-cropped to 400x400 WebP (about 20 to 40 KB). */
export async function squareAvatar(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 400;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 400, 400);
  return encode(canvas, 0.85);
}

/** Where a video link points, for the label on a post. */
export function videoHost(url: string) {
  const host = url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").toLowerCase();
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("youtu")) return "YouTube";
  if (host.includes("vimeo")) return "Vimeo";
  return "Video";
}
