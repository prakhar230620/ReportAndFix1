import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "worker") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar brand="My Tasks" items={[{ href: "/worker", label: "Tasks" }, { href: "/", label: "Home" }]} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
