import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { listLessons } from "@/lib/actions/lessons";

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "heute erstellt";
  if (diffDays === 1) return "gestern erstellt";
  return `vor ${diffDays} Tagen erstellt`;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const lessons = await listLessons();

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-8">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold">Vokabelbox</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="hidden sm:inline">
            eingeloggt als {user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      <Link
        href="/lessons/new"
        className="flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-base font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50"
      >
        + Neue Lektion
      </Link>

      {lessons.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Lege deine erste Lektion an.
        </div>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/lessons/${lesson.id}`}
                className="block rounded-xl border border-gray-200 p-4 hover:border-gray-400 hover:bg-gray-50"
              >
                <p className="text-base font-medium">{lesson.name}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {lesson.vocab_count}{" "}
                  {lesson.vocab_count === 1 ? "Vokabel" : "Vokabeln"} ·{" "}
                  {formatRelativeDate(lesson.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
