import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
      <Link href="/" className="btn-ghost text-sm -ml-3">
        <ArrowLeft size={16} />
        Zurück
      </Link>

      <h1 className="font-display text-4xl font-bold -rotate-1">
        Neue Lektion
      </h1>

      <CreateLessonForm />
    </main>
  );
}
