import SignupForm from "./SignupForm";

export default async function Signup({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; error?: string }> }) {
  const sp = await searchParams;
  const role = sp.role === "pro" ? "pro" : sp.role === "client" ? "client" : null;
  return (
    <main className="wrap">
      <div className="auth">
        <SignupForm initialRole={role} next={sp.next ?? ""} linkError={sp.error === "link"} />
      </div>
    </main>
  );
}
