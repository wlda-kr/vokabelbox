import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLesson, type VocabularyItem } from "@/lib/actions/lessons";
import { SpeakButton } from "@/components/SpeakButton";
import { DeleteLessonButton } from "./DeleteLessonButton";

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "heute erstellt";
  if (diffDays === 1) return "gestern erstellt";
  return `vor ${diffDays} Tagen erstellt`;
}

const BOX_STYLES: Record<number, string> = {
  1: "bg-red-100 text-red-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-lime-100 text-lime-700",
  5: "bg-green-100 text-green-700",
};

function BoxBadge({ box }: { box: number }) {
  const cls = BOX_STYLES[box] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      aria-label={`Box ${box} von 5`}
    >
      Box {box}
    </span>
  );
}

export default async function LessonPage({
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

  const { lesson, vocabulary } = result;
  const count = vocabulary.length;

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-8">
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-block text-sm text-gray-600 hover:text-gray-900"
        >
          ← Zurück
        </Link>
        <h1 className="text-2xl font-semibold">{lesson.name}</h1>
        <p className="text-sm text-gray-600">
          {count} {count === 1 ? "Vokabel" : "Vokabeln"} ·{" "}
          {formatRelativeDate(lesson.created_at)}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href={`/lessons/${lesson.id}/learn`}
          className="flex min-h-[56px] items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-base font-medium text-white hover:bg-gray-800"
        >
          Lernen
        </Link>
        <ModeButtonDisabled label="Abfrage" />
        <ModeButtonDisabled label="Test" />
      </section>

      {count === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Diese Lektion enthält keine Vokabeln.
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            Alle Vokabeln
          </h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {vocabulary.map((item: VocabularyItem) => (
              <li
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4"
              >
                <SpeakButton text={item.term_source} />
                <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
                  <span className="truncate">{item.term_source}</span>
                  <span className="truncate text-gray-700">
                    {item.term_target}
                  </span>
                </div>
                <BoxBadge box={item.box} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-gray-200 pt-6">
        <DeleteLessonButton lessonId={lesson.id} lessonName={lesson.name} />
      </div>
    </main>
  );
}

function ModeButtonDisabled({ label }: { label: string }) {
  return (
    <div className="flex min-h-[56px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-gray-400">
      <span className="text-base font-medium">{label}</span>
      <span className="text-xs">Bald verfügbar</span>
    </div>
  );
}
