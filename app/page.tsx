import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-full flex-col items-start gap-4 p-6">
      <p className="text-sm">Eingeloggt als {user.email}</p>
      <LogoutButton />
    </main>
  );
}
