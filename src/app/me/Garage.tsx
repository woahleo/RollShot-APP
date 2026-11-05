"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { carLabel, type Car } from "@/lib/types";
import CarPhotos from "./CarPhotos";

const EMPTY = { year: "", make: "", model: "", color: "", mods: "" };

export default function Garage({ userId, cars }: { userId: string; cars: (Car & { public: boolean; shots: number; photos: string[] })[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().from("cars").insert({ owner_id: userId, ...form });
    if (error) return setError(error.message);
    setForm(EMPTY);
    router.refresh();
  }
  async function setPublic(id: string, on: boolean) {
    await createClient().from("cars").update({ public: on }).eq("id", id);
    router.refresh();
  }
  async function remove(c: { id: string; photos: string[] }) {
    const supabase = createClient();
    const { error } = await supabase.from("cars").delete().eq("id", c.id);
    if (error) return setError(error.message);
    if (c.photos.length) await supabase.storage.from("portfolio").remove(c.photos);
    router.refresh();
  }
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="split">
      <div className="list" style={{ alignContent: "start" }}>
        {cars.length === 0 && <p className="muted">Add your car so creators can see what they&apos;d be shooting.</p>}
        {cars.map((c) => (
          <div key={c.id} className="card garage-car">
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0 }}>{carLabel(c)}</h3>
              <span className="small muted">
                {c.shots > 0 ? `${c.shots} shoot${c.shots === 1 ? "" : "s"} posted` : "No shoots posted yet"}
                {c.mods ? ` · ${c.mods}` : ""}
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn small" href={`/car/${c.id}`}>Car page</Link>
              <button className="btn small" aria-pressed={c.public} onClick={() => setPublic(c.id, !c.public)}>
                {c.public ? "Shared" : "Private"}
              </button>
              <button className="btn small" onClick={() => remove(c)}>Remove</button>
            </div>
            <CarPhotos userId={userId} carId={c.id} photos={c.photos ?? []} />
          </div>
        ))}
      </div>
      <form className="card" onSubmit={add} data-tour="add-car">
        <h3>Add a car</h3>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label className="field" style={{ flex: "0 0 90px" }}><span>Year</span><input value={form.year} onChange={set("year")} /></label>
          <label className="field" style={{ flex: 1 }}><span>Make</span><input required value={form.make} onChange={set("make")} /></label>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label className="field" style={{ flex: 1 }}><span>Model</span><input required value={form.model} onChange={set("model")} /></label>
          <label className="field" style={{ flex: 1 }}><span>Color</span><input value={form.color} onChange={set("color")} /></label>
        </div>
        <label className="field"><span>Mods (optional)</span><input value={form.mods} onChange={set("mods")} placeholder="Wheels, wrap, exhaust" /></label>
        <button className="btn solid">Add to garage</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
