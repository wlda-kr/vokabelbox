import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLesson } from "@/lib/actions/lessons";
import { QuizSession } from "@/components/QuizSession";

export default async function TestPage({
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
          className="rounded-lg border-2 border-tomato bg-tomato/10 p-4 text-sm font-medium text-tomato-dark"
        >
          Lektion konnte nicht geladen werden: {result.error}
        </div>
      </main>
    );
  }

  if (result.vocabulary.length < 5) {
    redirect(`/lessons/${id}`);
  }

  return (
    <QuizSession
      lesson={result.lesson}
      vocabulary={result.vocabulary}
      mode="test"
    />
  );
}
