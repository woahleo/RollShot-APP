"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABEL, MAX_PHOTOS, MIN_PHOTOS, photoUrl, type Kind } from "@/lib/types";
import { compress, photoExt } from "@/lib/photos";
import { MAX_CAR_PHOTOS } from "@/app/me/CarPhotos";
import CityOptions from "@/components/CityOptions";
import MoreCities from "@/components/MoreCities";
import AgeBlocked from "@/components/AgeBlocked";
import { AGE_BLOCK_COOKIE, ageOn, MIN_AGE } from "@/lib/legal";

type Role = "client" | "pro";

export default function Onboarding({ userId, defaultName, initialRole, blocked: wasBlocked }: { userId: string; defaultName: string; initialRole: Role | null; blocked: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(initialRole);
  const [name, setName] = useState(defaultName);
  const [city, setCity] = useState<string>("");
  const [moreCities, setMoreCities] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("photo");
  const [car, setCar] = useState({ year: "", make: "", model: "", color: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [birth, setBirth] = useState("");
  const [blocked, setBlocked] = useState(wasBlocked);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);

  const [carPhotos, setCarPhotos] = useState<string[]>([]);

  /**
   * Photos go straight to the person's own folder as they pick them, before the account is made:
   * a creator's first shots, or a car owner's photos of their car.
   */
  async function addPhotos(files: FileList | null, forCar: boolean) {
    if (!files?.length) return;
    const have = forCar ? carPhotos.length : photos.length;
    const max = forCar ? MAX_CAR_PHOTOS : MAX_PHOTOS;
    const room = max - have;
    const list = Array.from(files).slice(0, Math.max(0, room));
    setError(files.length > room ? `You can add up to ${max} photos.` : "");
    setUploading(list.length);
    const supabase = createClient();
    const added: string[] = [];
    for (const f of list) {
      try {
        const blob = await compress(f);
        const path = `${userId}/${forCar ? "car-" : ""}${crypto.randomUUID()}.${photoExt(blob)}`;
        const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw error;
        added.push(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading((n) => n - 1);
    }
    (forCar ? setCarPhotos : setPhotos)((p) => [...p, ...added]);
  }

  function dropPhoto(path: string, forCar: boolean) {
    (forCar ? setCarPhotos : setPhotos)((p) => p.filter((x) => x !== path));
    createClient().storage.from("portfolio").remove([path]);
  }

  /** Thumbnails with remove buttons, and a picker until the limit. */
  const photoPicker = (list: string[], forCar: boolean, max: number, empty: string) => (
    <>
      {list.length > 0 && (
        <div className="onboard-photos">
          {list.map((ph, i) => (
            <div key={ph} className="onboard-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(ph)} alt={`Photo ${i + 1}`} />
              <button type="button" onClick={() => dropPhoto(ph, forCar)} aria-label={`Remove photo ${i + 1}`}>✕</button>
            </div>
          ))}
        </div>
      )}
      {list.length < max && (
        <label className={list.length ? "btn small" : "onboard-drop"} style={{ cursor: uploading ? "progress" : "pointer", justifySelf: list.length ? "start" : "stretch" }}>
          {uploading ? `Uploading ${uploading}…` : list.length ? "Add more" : empty}
          <input type="file" accept="image/*" multiple hidden disabled={uploading > 0} onChange={(e) => { addPhotos(e.target.files, forCar); e.target.value = ""; }} />
        </label>
      )}
    </>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return setError("Pick one to continue.");
    if (role === "pro" && photos.length < MIN_PHOTOS) return setError(`Add at least ${MIN_PHOTOS} photos of your work.`);
    if (role === "client" && !(car.year.trim() && car.make.trim() && car.model.trim())) return setError("Add your car's year, make and model.");
    if (role === "client" && carPhotos.length === 0) return setError("Add at least one photo of your car.");
    const age = ageOn(birth);
    if (age === null) return setError("Enter your date of birth.");
    setBusy(true); setError("");
    const supabase = createClient();
    if (age < MIN_AGE) {
      // The database deletes this sign-in; remember it on this browser so changing the date doesn't work.
      document.cookie = `${AGE_BLOCK_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      // confirm_age deletes the sign-in; AgeBlocked then deletes it again in case that call failed, and signs out.
      await supabase.rpc("confirm_age", { p_birth: birth });
      setBusy(false);
      return setBlocked(true);
    }
    const { data: ok, error: e0 } = await supabase.rpc("confirm_age", { p_birth: birth });
    if (e0 || ok !== true) { setBusy(false); return setError(e0?.message ?? "We couldn't check your date of birth. Try again."); }
    const { error: e1 } = await supabase.from("profiles").insert({ id: userId, role, name: name.trim() });
    if (e1) { setBusy(false); return setError(e1.message); }
    if (role === "pro") {
      const { error: e2 } = await supabase.from("pros").insert({ id: userId, city, more_cities: moreCities.filter((c) => c !== city), kind, photos });
      if (e2) { setBusy(false); return setError(e2.message); }
      router.replace("/pro/edit");
    } else {
      const { error: e3 } = await supabase.from("cars").insert({ owner_id: userId, ...car, photos: carPhotos });
      if (e3) { setBusy(false); return setError(e3.message); }
      router.replace("/book");
    }
    router.refresh();
  }

  const set = (k: keyof typeof car) => (e: React.ChangeEvent<HTMLInputElement>) => setCar({ ...car, [k]: e.target.value });

  if (blocked) return <AgeBlocked signedIn />;

  return (
    <form onSubmit={save}>
      <h1 style={{ fontSize: 40 }}>Almost there.</h1>
      <div className="chips" style={{ marginBottom: 20 }}>
        <button type="button" className="chip" aria-pressed={role === "client"} onClick={() => setRole("client")}>I own a car</button>
        <button type="button" className="chip" aria-pressed={role === "pro"} onClick={() => setRole("pro")}>I&apos;m a creator (photo or video)</button>
      </div>
      <label className="field"><span>Your name</span><input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Date of birth</span>
        <input type="date" required value={birth} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirth(e.target.value)} />
      </label>
      {role === "pro" && (
        <div className="field"><span>What you do</span>
          <div className="chips">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button type="button" key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
            ))}
          </div>
        </div>
      )}
      {role === "pro" && (
        <label className="field"><span>Your home city</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} required><option value="" disabled>Pick your city</option><CityOptions /></select>
        </label>
      )}
      {role === "pro" && city && <MoreCities home={city} value={moreCities} onChange={setMoreCities} />}
      {role === "pro" && (
        <div className="field"><span>Your best shots ({MIN_PHOTOS} to {MAX_PHOTOS})</span>
          {photoPicker(photos, false, MAX_PHOTOS, "Tap to add photos of your car work")}
          <span className="small muted">
            {photos.length < MIN_PHOTOS ? `${MIN_PHOTOS - photos.length} more to go. ` : ""}The first one is your cover. You can change them later.
          </span>
        </div>
      )}
      {role === "client" && (
        <>
          <p className="small muted">Show creators the car they&apos;ll be shooting. You can add more cars later in your garage.</p>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: "0 0 90px" }}><span>Year</span><input required value={car.year} onChange={set("year")} inputMode="numeric" maxLength={4} /></label>
            <label className="field" style={{ flex: 1 }}><span>Make</span><input required value={car.make} onChange={set("make")} placeholder="BMW" /></label>
          </div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 1 }}><span>Model</span><input required value={car.model} onChange={set("model")} placeholder="M3" /></label>
            <label className="field" style={{ flex: 1 }}><span>Color</span><input value={car.color} onChange={set("color")} /></label>
          </div>
          <div className="field"><span>Photos of your car (at least 1)</span>
            {photoPicker(carPhotos, true, MAX_CAR_PHOTOS, "Tap to add a photo of your car")}
          </div>
        </>
      )}
      <button className="btn solid" disabled={busy || !role || uploading > 0}>Continue</button>
      {error && <p className="error">{error}</p>}
      <p className="small muted">We only use your date of birth to check your age, and we don&apos;t save it. By continuing you agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</p>
    </form>
  );
}
