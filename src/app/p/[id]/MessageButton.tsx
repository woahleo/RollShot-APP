"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MessageButton({ proId }: { proId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function open() {
    const { data, error } = await createClient().rpc("open_thread", { p_pro: proId });
    if (error) return setError(error.message);
    router.push(`/messages/${data}`);
  }
  return (
    <>
      <button className="btn" style={{ width: "100%" }} onClick={open}>Message (3 before booking)</button>
      {error && <p className="error">{error}</p>}
    </>
  );
}
