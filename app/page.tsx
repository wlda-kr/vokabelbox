import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getDueCount, listLessons } from "@/lib/actions/lessons";

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "heute erstellt";
  if (diffDays === 1) return "gestern erstellt";
  return `vor ${diffDays} Tagen erstellt`;
}

function EmptyState() {
  return (
    <div className="card bg-paper text-center space-y-5 py-10">
      <svg
        aria-hidden
        viewBox="0 0 160 120"
        className="mx-auto h-28 w-40"
      >
        <rect
          x="18"
          y="30"
          width="96"
          height="72"
          rx="8"
          fill="#fffbf0"
          stroke="#1a2a3a"
          strokeWidth="4"
        />
        <line
          x1="34"
          y1="52"
          x2="98"
          y2="52"
          stroke="#1a2a3a"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="34"
          y1="66"
          x2="86"
          y2="66"
          stroke="#1a2a3a"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="34"
          y1="80"
          x2="92"
          y2="80"
          stroke="#1a2a3a"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect
          x="92"
          y="20"
          width="56"
          height="48"
          rx="8"
          fill="#e04832"
          stroke="#1a2a3a"
          strokeWidth="4"
        />
        <circle
          cx="120"
          cy="44"
          r="12"
          fill="#fdf6e3"
          stroke="#1a2a3a"
          strokeWidth="4"
        />
        <path
          d="M 104 20 L 108 14 L 132 14 L 136 20"
          fill="none"
          stroke="#1a2a3a"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
      <div className="space-y-2 px-4">
        <p className="font-display text-2xl font-bold">Noch keine Lektion.</p>
        <p className="text-sm text-ink-soft">
          Mach ein Foto aus dem Buch, ich mache den Rest.
        </p>
      </div>
      <Link href="/lessons/new" className="btn-primary">
        <Plus size={18} />
        Erste Lektion anlegen
      </Link>
    </div>
  );
}

function TodayHero({
  total,
  lessonCount,
}: {
  total: number;
  lessonCount: number;
}) {
  return (
    <section className="rounded-xl border-2 border-navy bg-sunshine p-6 shadow-pop-lg space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl font-bold -rotate-1 leading-tight">
            Heute
          </h2>
          <p className="mt-2 text-base text-navy">
            Du hast <span className="font-bold">{total}</span>{" "}
            {total === 1 ? "Vokabel" : "Vokabeln"} zu wiederholen
            {lessonCount > 0 && (
              <>
                {" "}
                aus <span className="font-bold">{lessonCount}</span>{" "}
                {lessonCount === 1 ? "Lektion" : "Lektionen"}
              </>
            )}
            .
          </p>
        </div>
        <Sparkles aria-hidden size={28} className="shrink-0 text-navy" />
      </div>
      <Link href="/today" className="btn-primary w-full text-lg py-4">
        Jetzt starten
      </Link>
    </section>
  );
}

function TodayQuiet() {
  return (
    <section className="card-flat text-center space-y-1">
      <p className="font-bold">Heute ist nichts fällig.</p>
      <p className="text-sm text-ink-soft">
        Schau später wieder rein oder lege eine neue Lektion an.
      </p>
    </section>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [lessons, dueStats] = await Promise.all([
    listLessons(),
    getDueCount(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl p-6 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <h1 className="font-display text-4xl md:text-5xl font-bold -rotate-1 text-navy">
          Vokabelbox
        </h1>
        <div className="flex flex-col items-end gap-1 text-sm">
          <span className="hidden sm:inline text-ink-soft truncate max-w-[200px]">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {lessons.length > 0 &&
        (dueStats.total > 0 ? (
          <TodayHero
            total={dueStats.total}
            lessonCount={dueStats.lessonCount}
          />
        ) : (
          <TodayQuiet />
        ))}

      {lessons.length > 0 && (
        <Link
          href="/lessons/new"
          className="btn-secondary w-full text-lg py-4"
        >
          <Plus size={20} />
          Neue Lektion
        </Link>
      )}

      {lessons.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lessons.map((lesson, idx) => {
            const badgeColor = idx % 2 === 0 ? "bg-coral" : "bg-sunshine";
            const badgeText =
              idx % 2 === 0 ? "text-paper" : "text-navy";
            return (
              <li key={lesson.id}>
                <Link
                  href={`/lessons/${lesson.id}`}
                  className="card flex h-full flex-col gap-3 transition-all hover:shadow-pop-lg hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-bold leading-tight">
                      {lesson.name}
                    </h2>
                    <span
                      className={`badge whitespace-nowrap ${badgeColor} ${badgeText}`}
                    >
                      {lesson.vocab_count}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft mt-auto">
                    {lesson.vocab_count === 1 ? "1 Vokabel" : `${lesson.vocab_count} Vokabeln`}
                    {" · "}
                    {formatRelativeDate(lesson.created_at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
