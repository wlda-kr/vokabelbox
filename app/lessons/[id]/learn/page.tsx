import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLesson } from "@/lib/actions/lessons";
import { LearnSession } from "./LearnSession";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = await getLesson(id);
  if ("error" in result) {
    if (result.error === "not_found") notFound();
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Lektion konnte nicht geladen werden: {result.error}
        </div>
      </main>
    );
  }

  if (result.vocabulary.length === 0) {
    redirect(`/lessons/${id}`);
  }

  return <LearnSession lessonId={id} vocabulary={result.vocabulary} />;
}
