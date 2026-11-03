/** Shrinks a photo to at most 2000px on the long side and re-encodes it as WebP (about 300 to 600 KB). */
export async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read that image"))), "image/webp", 0.82));
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
