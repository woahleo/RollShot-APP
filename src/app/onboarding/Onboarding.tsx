"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABEL, type Kind } from "@/lib/types";
import CityOptions from "@/components/CityOptions";
import AgeBlocked from "@/components/AgeBlocked";
import { AGE_BLOCK_COOKIE, ageOn, MIN_AGE } from "@/lib/legal";

type Role = "client" | "pro";

export default function Onboarding({ userId, defaultName, initialRole, blocked: wasBlocked }: { userId: string; defaultName: string; initialRole: Role | null; blocked: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(initialRole);
  const [name, setName] = useState(defaultName);
  const [city, setCity] = useState<string>("");
  const [kind, setKind] = useState<Kind>("photo");
  const [car, setCar] = useState({ year: "", make: "", model: "", color: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [birth, setBirth] = useState("");
  const [blocked, setBlocked] = useState(wasBlocked);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return setError("Pick one to continue.");
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
      const { error: e2 } = await supabase.from("pros").insert({ id: userId, city, kind });
      if (e2) { setBusy(false); return setError(e2.message); }
      router.replace("/pro/edit");
    } else {
      if (car.make || car.model) await supabase.from("cars").insert({ owner_id: userId, ...car });
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
        <label className="field"><span>Where you shoot</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} required><option value="" disabled>Pick your city</option><CityOptions /></select>
        </label>
      )}
      {role === "client" && (
        <>
          <p className="small muted">Add your car so creators know what they&apos;re working with. You can skip this.</p>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: "0 0 90px" }}><span>Year</span><input value={car.year} onChange={set("year")} inputMode="numeric" /></label>
            <label className="field" style={{ flex: 1 }}><span>Make</span><input value={car.make} onChange={set("make")} placeholder="BMW" /></label>
          </div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 1 }}><span>Model</span><input value={car.model} onChange={set("model")} placeholder="M3" /></label>
            <label className="field" style={{ flex: 1 }}><span>Color</span><input value={car.color} onChange={set("color")} /></label>
          </div>
        </>
      )}
      <button className="btn solid" disabled={busy || !role}>Continue</button>
      {error && <p className="error">{error}</p>}
      <p className="small muted">We only use your date of birth to check your age, and we don&apos;t save it. By continuing you agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</p>
    </form>
  );
}
