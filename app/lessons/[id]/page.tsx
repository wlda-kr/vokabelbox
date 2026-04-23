import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Book,
  Brain,
  ChevronDown,
  ClipboardCheck,
  Flame,
  Sparkles,
  Target,
} from "lucide-react";
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

const BOX_BG: Record<number, string> = {
  1: "bg-box-1",
  2: "bg-box-2",
  3: "bg-box-3",
  4: "bg-box-4",
  5: "bg-box-5",
};

const BOX_FG: Record<number, string> = {
  1: "text-paper",
  2: "text-navy",
  3: "text-navy",
  4: "text-paper",
  5: "text-paper",
};

function HelpDetails() {
  return (
    <details className="group card-flat">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold">
        <span>Wie funktioniert das?</span>
        <ChevronDown
          aria-hidden
          size={18}
          className="transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="mt-4 space-y-3 text-sm text-navy">
        <p>Jede Vokabel lebt in einer der 5 Boxen:</p>
        <ul className="space-y-1 pl-1">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-box-1 text-xs font-bold text-paper">
              1
            </span>
            <span>Neu oder noch unsicher – täglich üben</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-box-2 text-xs font-bold text-navy">
              2
            </span>
            <span>Einmal richtig – alle 2 Tage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-box-3 text-xs font-bold text-navy">
              3
            </span>
            <span>Zweimal richtig – alle 4 Tage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-box-4 text-xs font-bold text-paper">
              4
            </span>
            <span>Sitzt fast – alle 7 Tage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-box-5 text-xs font-bold text-paper">
              5
            </span>
            <span>Gemeistert – alle 2 Wochen</span>
          </li>
        </ul>
        <p>
          Richtige Antworten schicken Vokabeln eine Box höher, falsche eine
          zurück. Bei „Fast richtig" (nur Schreibfehler) bleibt die Box
          gleich.
        </p>
        <p>
          Die Seite <span className="font-bold">Heute</span> zeigt dir, was
          gerade fällig ist – das ist dein tägliches Lern-Ziel.
        </p>
      </div>
    </details>
  );
}

function BoxBadge({ box }: { box: number }) {
  const bg = BOX_BG[box] ?? "bg-paper";
  const fg = BOX_FG[box] ?? "text-navy";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-navy font-bold text-xs ${bg} ${fg}`}
      aria-label={`Box ${box} von 5`}
      title={`Box ${box} von 5`}
    >
      {box}
    </span>
  );
}

type ModeVariant = {
  wrapper: string;
  iconBg: string;
};

const MODE_QUIZ: ModeVariant = {
  wrapper:
    "bg-teal text-paper shadow-pop hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pop-lg",
  iconBg: "bg-paper text-teal-dark",
};

const MODE_TEST: ModeVariant = {
  wrapper:
    "bg-sunshine text-navy shadow-pop hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pop-lg",
  iconBg: "bg-paper text-navy",
};

const MODE_TEST_DISABLED: ModeVariant = {
  wrapper: "bg-sunshine/40 text-navy/60 cursor-not-allowed",
  iconBg: "bg-paper/60 text-navy/50",
};

function ModeCard({
  title,
  subtitle,
  icon,
  variant,
  href,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  variant: ModeVariant;
  href?: string;
}) {
  const content = (
    <>
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy ${variant.iconBg}`}
      >
        {icon}
      </span>
      <span className="font-display text-xl font-bold">{title}</span>
      <span className="text-xs font-medium">{subtitle}</span>
    </>
  );

  const base =
    "flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-navy px-4 py-5 text-center transition-all";

  if (href) {
    return (
      <Link href={href} className={`${base} ${variant.wrapper}`}>
        {content}
      </Link>
    );
  }
  return <div className={`${base} ${variant.wrapper}`}>{content}</div>;
}

type LearnScope = {
  title: string;
  subtitle: string;
  count: number;
  href: string;
  icon: React.ReactNode;
  emphasized: boolean;
};

function LearnCard({ lessonId, scopes }: { lessonId: string; scopes: LearnScope[] }) {
  return (
    <details className="group relative rounded-xl border-2 border-navy bg-tomato text-paper shadow-pop transition-all sm:col-span-1">
      <summary className="flex min-h-[140px] cursor-pointer list-none flex-col items-center justify-center gap-2 px-4 py-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy bg-paper text-tomato">
          <Brain size={24} />
        </span>
        <span className="font-display text-xl font-bold">Lernen</span>
        <span className="flex items-center gap-1 text-xs font-medium">
          Box-Filter wählen
          <ChevronDown
            aria-hidden
            size={14}
            className="transition-transform duration-200 group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="space-y-2 border-t-2 border-navy/20 bg-paper p-3 text-navy rounded-b-xl">
        {scopes.map((scope) => (
          <Link
            key={scope.href}
            href={`/lessons/${lessonId}/learn${scope.href}`}
            className={`flex items-center justify-between gap-3 rounded-lg border-2 border-navy px-3 py-2 text-sm transition-colors ${
              scope.emphasized
                ? "bg-tomato text-paper"
                : "bg-paper hover:bg-cream"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {scope.icon}
              </span>
              <span>
                <span className="font-bold block">{scope.title}</span>
                <span className="text-xs opacity-80">{scope.subtitle}</span>
              </span>
            </span>
            <span className="text-sm font-bold tabular-nums">{scope.count}</span>
          </Link>
        ))}
      </div>
    </details>
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
          className="rounded-lg border-2 border-tomato bg-tomato/10 p-4 text-sm font-medium text-tomato-dark"
        >
          Lektion konnte nicht geladen werden: {result.error}
        </div>
      </main>
    );
  }

  const { lesson, vocabulary } = result;
  const count = vocabulary.length;

  const weakCount = vocabulary.filter((v) => v.box <= 2).length;
  const newCount = vocabulary.filter(
    (v) => v.box === 1 && v.correct_count + v.wrong_count === 0,
  ).length;

  // Wenn weak-Pool leer ist, schicken wir den Schwach-Button auf "all" mit
  // einer freundlichen Notiz, dass alles sitzt.
  const weakHref =
    weakCount > 0 ? "?scope=weak" : "?scope=all&reason=all_mastered";
  const newHref =
    newCount > 0 ? "?scope=new" : "?scope=all&reason=nothing_new";

  const scopes: LearnScope[] = [
    {
      title: "Schwache Wörter",
      subtitle: weakCount > 0 ? "Box 1-2" : "alle sitzen — auffrischen",
      count: weakCount > 0 ? weakCount : count,
      href: weakHref,
      icon: <Flame size={16} />,
      emphasized: true,
    },
    {
      title: "Neue Wörter",
      subtitle: newCount > 0 ? "noch nie geübt" : "alle schon angefangen",
      count: newCount > 0 ? newCount : count,
      href: newHref,
      icon: <Sparkles size={16} />,
      emphasized: false,
    },
    {
      title: "Alle Wörter",
      subtitle: "komplette Liste",
      count,
      href: "?scope=all",
      icon: <Book size={16} />,
      emphasized: false,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl p-6 space-y-8">
      <div className="space-y-3">
        <Link href="/" className="btn-ghost text-sm -ml-3">
          <ArrowLeft size={16} />
          Zurück
        </Link>
        <h1 className="font-display text-4xl font-bold leading-tight -rotate-1">
          {lesson.name}
        </h1>
        <p className="text-sm text-ink-soft">
          {count === 1 ? "1 Vokabel" : `${count} Vokabeln`} ·{" "}
          {formatRelativeDate(lesson.created_at)}
        </p>
      </div>

      <HelpDetails />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {count === 0 ? (
          <ModeCard
            title="Lernen"
            subtitle="Keine Vokabeln"
            icon={<Brain size={24} />}
            variant={MODE_TEST_DISABLED}
          />
        ) : (
          <LearnCard lessonId={lesson.id} scopes={scopes} />
        )}
        {count === 0 ? (
          <ModeCard
            title="Abfrage"
            subtitle="Keine Vokabeln"
            icon={<Target size={24} />}
            variant={MODE_TEST_DISABLED}
          />
        ) : (
          <ModeCard
            title="Abfrage"
            subtitle="Alle Vokabeln, Tippeingabe"
            icon={<Target size={24} />}
            variant={MODE_QUIZ}
            href={`/lessons/${lesson.id}/quiz`}
          />
        )}
        {count >= 5 ? (
          <ModeCard
            title="Test"
            subtitle="30 Vokabeln mit Note"
            icon={<ClipboardCheck size={24} />}
            variant={MODE_TEST}
            href={`/lessons/${lesson.id}/test`}
          />
        ) : (
          <ModeCard
            title="Test"
            subtitle="Mind. 5 Vokabeln nötig"
            icon={<ClipboardCheck size={24} />}
            variant={MODE_TEST_DISABLED}
          />
        )}
      </section>

      {count === 0 ? (
        <div className="card bg-paper text-center text-sm text-ink-soft py-8">
          Diese Lektion enthält keine Vokabeln.
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Alle Vokabeln</h2>
          <ul className="space-y-2">
            {vocabulary.map((item: VocabularyItem) => (
              <li
                key={item.id}
                className="card-flat flex items-center gap-3 p-3"
              >
                <SpeakButton text={item.term_source} />
                <div className="flex-1 min-w-0">
                  <p className="truncate italic font-medium text-tomato-dark">
                    {item.term_source}
                  </p>
                  <p className="truncate text-sm text-navy">
                    {item.term_target}
                  </p>
                </div>
                <BoxBadge box={item.box} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t-2 border-navy/20 pt-6">
        <DeleteLessonButton lessonId={lesson.id} lessonName={lesson.name} />
      </div>
    </main>
  );
}
