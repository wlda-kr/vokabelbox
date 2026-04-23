import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateLessonForm } from "./CreateLessonForm";

export default async function NewLessonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-6">
      <Link
        href="/"
        className="inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Zurück
      </Link>

      <h1 className="text-2xl font-semibold">Neue Lektion</h1>

      <CreateLessonForm />
    </main>
  );
}
