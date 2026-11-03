"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { carLabel, type Car } from "@/lib/types";

const EMPTY = { year: "", make: "", model: "", color: "", mods: "" };

export default function Garage({ userId, cars }: { userId: string; cars: Car[] }) {
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
  async function remove(id: string) {
    await createClient().from("cars").delete().eq("id", id);
    router.refresh();
  }
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="split">
      <div className="list" style={{ alignContent: "start" }}>
        {cars.length === 0 && <p className="muted">Add your car so photographers can plan the shot.</p>}
        {cars.map((c) => (
          <div key={c.id} className="card">
            <div>
              <h3 style={{ margin: 0 }}>{carLabel(c)}</h3>
              {c.mods && <span className="small muted">{c.mods}</span>}
            </div>
            <button className="btn small" onClick={() => remove(c.id)}>Remove</button>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={add}>
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
