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

/** A square profile picture: center-cropped to 400x400 WebP (about 20 to 40 KB). */
export async function squareAvatar(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 400;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 400, 400);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read that image"))), "image/webp", 0.85));
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

/**
 * A cover image for a video, taken from about half a second in, at most 720px wide, as JPEG.
 * Also returns how long the video is. Fails for formats this browser can't play.
 */
export async function videoCover(file: File): Promise<{ blob: Blob; seconds: number }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("This browser can't read that video. Try exporting it as MP4."));
      setTimeout(() => fail(new Error("That video took too long to open.")), 15000);
    });
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    });
    const scale = Math.min(1, 720 / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not make a cover"))), "image/jpeg", 0.8));
    return { blob, seconds: v.duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}
