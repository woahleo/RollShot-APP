import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const OG_SIZE = { width: 1200, height: 630 };

const PINK = "#ff4f9a";
const SKY = "#36c5f0";
const SUN = "#ffc84a";
const INK = "#0a0a0a";
const MUTED = "#636369";

/** A signed-out client: link previews only ever show what anyone can see. */
export function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

async function fonts() {
  const dir = join(process.cwd(), "src/assets/fonts");
  const [thin, regular] = await Promise.all([readFile(join(dir, "Outfit-200.ttf")), readFile(join(dir, "Outfit-400.ttf"))]);
  return [
    { name: "Outfit", data: thin, weight: 200 as const, style: "normal" as const },
    { name: "Outfit", data: regular, weight: 400 as const, style: "normal" as const },
  ];
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s = 44;
  const b = `3px solid ${INK}`;
  // The image renderer chokes on undefined style values, so only set the sides this corner uses.
  const v = pos[0] === "t" ? { top: 0, borderTop: b } : { bottom: 0, borderBottom: b };
  const h = pos[1] === "l" ? { left: 0, borderLeft: b } : { right: 0, borderRight: b };
  return <div style={{ position: "absolute", width: s, height: s, ...v, ...h }} />;
}

/** The camera viewfinder with the line-art car, the same one as the home page. */
function Viewfinder() {
  return (
    <div style={{ position: "relative", display: "flex", width: 420, height: 330, alignItems: "center", justifyContent: "center" }}>
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />
      <div style={{ position: "absolute", top: 18, left: 22, right: 22, display: "flex", justifyContent: "space-between", fontSize: 20, color: MUTED }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: PINK }} />
          REC
        </div>
        <div style={{ display: "flex" }}>4K · 24</div>
      </div>
      <svg width="340" height="125" viewBox="0 0 300 110" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M18 80 L24 66 Q30 60 62 56 L102 38 Q116 32 146 32 L180 33 Q204 35 222 49 L252 55 Q276 59 283 70 L285 80" />
        <path d="M18 80 H62 M98 80 H214 M250 80 H285" />
        <path d="M108 54 L124 40 Q132 37 146 37 L176 38 Q194 40 206 52 Z" />
        <path d="M156 38 L154 53" />
        <circle cx="80" cy="80" r="17" />
        <circle cx="80" cy="80" r="7" />
        <circle cx="232" cy="80" r="17" />
        <circle cx="232" cy="80" r="7" />
      </svg>
      <div style={{ position: "absolute", bottom: 18, left: 22, right: 22, display: "flex", justifyContent: "space-between", fontSize: 20, color: MUTED }}>
        <div style={{ display: "flex" }}>f/2.8</div>
        <div style={{ display: "flex" }}>1/250</div>
        <div style={{ display: "flex" }}>ISO 100</div>
      </div>
    </div>
  );
}

/** A person's photo framed by the viewfinder corners, in place of the car sketch. */
function PhotoFrame({ src }: { src: string }) {
  return (
    <div style={{ position: "relative", display: "flex", width: 430, height: 430, alignItems: "center", justifyContent: "center" }}>
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={370} height={370} alt="" style={{ width: 370, height: 370, borderRadius: 24, objectFit: "cover" }} />
      <div style={{ position: "absolute", top: 44, left: 44, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(10,10,10,.55)", color: "#fff", fontSize: 18 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: PINK }} />
        REC
      </div>
    </div>
  );
}

/**
 * Load a public image for the card as a data URL. The card renderer reads PNG and JPEG reliably,
 * and uploads here are usually WebP, so anything else is turned into a JPEG first.
 * Returns null when there's nothing usable, so the card falls back to the car sketch.
 */
export async function loadPhoto(url: string | null | undefined) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    let buf = Buffer.from(await res.arrayBuffer());
    let type = res.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpeg)$/.test(type)) {
      const sharp = (await import("sharp")).default;
      buf = await sharp(buf).rotate().resize(740, 740, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
      type = "image/jpeg";
    }
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The link preview card. With no title it is the Rollshot card itself;
 * with one it is a shoot or a creator, still clearly from Rollshot.
 */
export async function ogCard(opts: { eyebrow?: string; title?: string; lines?: string[]; photo?: string | null } = {}) {
  const brand = !opts.title;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "Outfit", color: INK }}>
        <div style={{ height: 10, width: "100%", display: "flex", backgroundImage: `linear-gradient(90deg, ${PINK}, ${SKY} 55%, ${SUN})` }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 80px" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
            {brand ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 26, color: MUTED, letterSpacing: 1 }}>West Palm Beach · Boca · Fort Lauderdale · Miami</div>
                <div style={{ display: "flex", alignItems: "flex-end", fontSize: 150, fontWeight: 200, letterSpacing: -6, lineHeight: 1, marginTop: 22 }}>
                  Rollshot
                  <div style={{ width: 30, height: 30, borderRadius: 15, background: PINK, marginLeft: 8, marginBottom: 22 }} />
                </div>
                <div style={{ display: "flex", fontSize: 44, fontWeight: 200, lineHeight: 1.2, marginTop: 26 }}>
                  Your car, shot&nbsp;<span style={{ color: PINK }}>right.</span>
                </div>
                <div style={{ display: "flex", fontSize: 28, color: MUTED, lineHeight: 1.35, marginTop: 14 }}>
                  Book car photo and video creators by the shoot.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 400 }}>
                  Rollshot
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: PINK, marginLeft: 3, marginTop: 10 }} />
                  {opts.eyebrow && <span style={{ color: MUTED, fontWeight: 200, marginLeft: 16 }}>{opts.eyebrow}</span>}
                </div>
                <div style={{ display: "flex", fontSize: (opts.title ?? "").length > 22 ? 72 : 92, fontWeight: 200, letterSpacing: -3, lineHeight: 1.05, marginTop: 28 }}>
                  {opts.title}
                </div>
                {(opts.lines ?? []).map((l, i) => (
                  <div key={i} style={{ display: "flex", fontSize: 32, color: i === 0 ? INK : MUTED, lineHeight: 1.3, marginTop: i === 0 ? 24 : 6 }}>
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
          {opts.photo ? <PhotoFrame src={opts.photo} /> : <Viewfinder />}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
