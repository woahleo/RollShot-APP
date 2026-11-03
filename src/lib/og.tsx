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

/** When there's no photo: the viewfinder corners around the first letter on the brand gradient. */
function Monogram({ letter }: { letter: string }) {
  return (
    <div style={{ position: "relative", display: "flex", width: 430, height: 430, alignItems: "center", justifyContent: "center" }}>
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />
      <div style={{ display: "flex", width: 260, height: 260, borderRadius: 130, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(135deg, ${PINK}, ${SKY} 60%, ${SUN})`, color: "#fff", fontSize: 130, fontWeight: 400 }}>
        {letter}
      </div>
    </div>
  );
}

/** The Rollshot card itself: the whole card is the viewfinder, with the name in the middle. */
function BrandCard() {
  const label = { display: "flex", fontSize: 22, color: MUTED, letterSpacing: 1 } as const;
  return (
    <div style={{ position: "relative", flex: 1, display: "flex", margin: 48 }}>
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />
      <div style={{ position: "absolute", top: 22, left: 30, right: 30, display: "flex", justifyContent: "space-between" }}>
        <div style={{ ...label, alignItems: "center", gap: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: PINK }} />
          REC
        </div>
        <div style={label}>4K · 24</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 170, fontWeight: 200, letterSpacing: -7, lineHeight: 1 }}>
          Rollshot
          <div style={{ width: 34, height: 34, borderRadius: 17, background: PINK, marginLeft: 10, marginBottom: 24 }} />
        </div>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 200, lineHeight: 1.2, marginTop: 24 }}>
          Your car, shot&nbsp;<span style={{ color: PINK }}>right.</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 16 }}>
          Car photo and video creators in South Florida
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 22, left: 30, right: 30, display: "flex", justifyContent: "space-between" }}>
        <div style={label}>West Palm Beach · Boca · Fort Lauderdale · Miami</div>
        <div style={label}>f/2.8 · 1/250</div>
      </div>
    </div>
  );
}

/** A person's photo framed by the viewfinder corners. */
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
 * Returns null when there's nothing usable, so the card falls back to the first letter.
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
        {brand ? (
          <BrandCard />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 80px" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
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
            {opts.photo ? <PhotoFrame src={opts.photo} /> : <Monogram letter={/^[a-z]/i.test((opts.title ?? "").trim()) ? (opts.title ?? "").trim()[0].toUpperCase() : "R"} />}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
