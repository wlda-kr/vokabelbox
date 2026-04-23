import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  ClipboardCheck,
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

const MODE_ACTIVE: ModeVariant = {
  wrapper:
    "bg-tomato text-paper shadow-pop hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pop-lg",
  iconBg: "bg-paper text-tomato",
};

const MODE_DISABLED_TEAL: ModeVariant = {
  wrapper: "bg-teal/40 text-navy/60 cursor-not-allowed",
  iconBg: "bg-paper/60 text-navy/50",
};

const MODE_DISABLED_SUNSHINE: ModeVariant = {
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ModeCard
          title="Lernen"
          subtitle="Karteikarten durchgehen"
          icon={<Brain size={24} />}
          variant={MODE_ACTIVE}
          href={`/lessons/${lesson.id}/learn`}
        />
        <ModeCard
          title="Abfrage"
          subtitle="Bald verfügbar"
          icon={<Target size={24} />}
          variant={MODE_DISABLED_TEAL}
        />
        <ModeCard
          title="Test"
          subtitle="Bald verfügbar"
          icon={<ClipboardCheck size={24} />}
          variant={MODE_DISABLED_SUNSHINE}
        />
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
