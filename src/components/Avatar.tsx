import { photoUrl } from "@/lib/types";

/** A round profile picture, or the first letter of the name on the brand gradient when there isn't one. */
export default function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="pic" src={photoUrl(avatar)} alt="" style={style} />;
  }
  return (
    <span className="pic initial" aria-hidden="true" style={style}>
      {(name.trim()[0] ?? "R").toUpperCase()}
    </span>
  );
}
