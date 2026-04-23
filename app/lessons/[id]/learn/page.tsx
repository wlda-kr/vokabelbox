import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLesson, type VocabularyItem } from "@/lib/actions/lessons";
import { LearnSession } from "./LearnSession";

type Scope = "weak" | "new" | "all";

function parseScope(raw: string | undefined): Scope {
  if (raw === "weak" || raw === "new") return raw;
  return "all";
}

function filterVocabulary(
  vocabulary: VocabularyItem[],
  scope: Scope,
): VocabularyItem[] {
  if (scope === "weak") return vocabulary.filter((v) => v.box <= 2);
  if (scope === "new") {
    return vocabulary.filter(
      (v) => v.box === 1 && v.correct_count + v.wrong_count === 0,
    );
  }
  return vocabulary;
}

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string; reason?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const scope = parseScope(sp.scope);
  const reason = sp.reason;

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

  const filtered = filterVocabulary(result.vocabulary, scope);

  if (filtered.length === 0) {
    redirect(`/lessons/${id}?empty=${scope}`);
  }

  const notice =
    reason === "all_mastered"
      ? "Alle Wörter sitzen – super! Hier ist die komplette Liste zum Auffrischen."
      : reason === "nothing_new"
        ? "Keine neuen Wörter mehr – hier ist die komplette Liste."
        : null;

  return (
    <LearnSession
      lessonId={id}
      vocabulary={filtered}
      scope={scope}
      notice={notice}
    />
  );
}
