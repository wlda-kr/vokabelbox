"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, RotateCcw, Trophy } from "lucide-react";
import { SpeakButton } from "@/components/SpeakButton";
import {
  updateVocabularyReview,
  type DueVocabularyItem,
} from "@/lib/actions/lessons";

type Props = {
  vocabulary: DueVocabularyItem[];
};

export function TodaySession({ vocabulary }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<DueVocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ known: 0, unknown: 0 });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Queue kommt bereits serverseitig priorisiert + geshuffled.
    setQueue(vocabulary);
    setMounted(true);
  }, [vocabulary]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);

  if (!mounted || queue.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <p className="text-sm text-ink-soft">Lade Heute-Liste…</p>
      </main>
    );
  }

  async function handleAnswer(known: boolean) {
    if (submitting || done) return;
    const item = queue[currentIndex];
    if (!item) return;

    setSubmitting(true);
    const res = await updateVocabularyReview(item.id, known);
    setSubmitting(false);

    if ("error" in res) {
      setError(res.error);
    }

    setResults((prev) => ({
      known: prev.known + (known ? 1 : 0),
      unknown: prev.unknown + (known ? 0 : 1),
    }));

    const nextIndex = currentIndex + 1;
    setFlipped(false);
    if (nextIndex >= queue.length) {
      setDone(true);
    } else {
      setCurrentIndex(nextIndex);
    }
  }

  const total = queue.length;
  const position = done ? total : currentIndex + 1;
  const progressPct = Math.round(((done ? total : currentIndex) / total) * 100);
  const currentItem = queue[currentIndex];

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="btn-ghost text-sm -ml-3">
          <ArrowLeft size={16} />
          Abbrechen
        </Link>
        <span className="text-sm font-bold tabular-nums">
          Heute · {position} / {total}
        </span>
      </header>

      <div
        className="h-4 w-full overflow-hidden rounded-full border-2 border-navy bg-paper"
        aria-label="Fortschritt"
      >
        <div
          className="h-full bg-tomato transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border-2 border-tomato bg-tomato/10 px-3 py-2 text-sm font-medium text-tomato-dark"
        >
          {error}
        </div>
      )}

      {done ? (
        <DoneCard
          known={results.known}
          unknown={results.unknown}
          onFinish={() => {
            router.push("/");
            router.refresh();
          }}
        />
      ) : currentItem ? (
        <>
          <FlipCard
            item={currentItem}
            flipped={flipped}
            onFlip={() => setFlipped((prev) => !prev)}
          />

          {flipped && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleAnswer(false)}
                disabled={submitting}
                className="btn-primary"
              >
                <RotateCcw size={16} aria-hidden />
                Nochmal
              </button>
              <button
                type="button"
                onClick={() => handleAnswer(true)}
                disabled={submitting}
                className="btn-secondary"
              >
                <Check size={16} aria-hidden />
                Kann ich
              </button>
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}

function FlipCard({
  item,
  flipped,
  onFlip,
}: {
  item: DueVocabularyItem;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <div className="flip-card w-full">
      <div
        className={`flip-card-inner ${flipped ? "is-flipped" : ""}`}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFlip();
          }
        }}
      >
        <div className="flip-card-face flip-card-front">
          <div className="relative flex h-full min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-navy bg-paper p-6 text-center shadow-pop-lg">
            <p className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-wide text-ink-soft max-w-[80%] truncate">
              aus: {item.lesson_name}
            </p>
            <p className="font-display text-4xl md:text-5xl font-bold leading-tight text-navy">
              {item.term_source}
            </p>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-ink-soft">
              Tippen zum Umdrehen
            </p>
            <div
              className="absolute bottom-3 right-3"
              onClick={(event) => event.stopPropagation()}
            >
              <SpeakButton text={item.term_source} />
            </div>
          </div>
        </div>
        <div className="flip-card-face flip-card-back">
          <div className="flex h-full min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-navy bg-navy p-6 text-center text-paper shadow-pop-lg">
            <p className="font-display text-4xl md:text-5xl font-bold leading-tight">
              {item.term_target}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoneCard({
  known,
  unknown,
  onFinish,
}: {
  known: number;
  unknown: number;
  onFinish: () => void;
}) {
  return (
    <section className="card bg-sunshine text-center space-y-6 py-10">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-navy bg-paper shadow-pop">
          <Trophy aria-hidden size={32} className="text-tomato" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="font-display text-4xl font-bold">¡Perfecto!</h2>
        <p className="text-sm text-ink-soft">Heute ist erledigt.</p>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="space-y-1">
          <p className="font-display text-4xl font-bold text-teal-dark">
            {known}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            gekannt
          </p>
        </div>
        <div className="h-10 w-px bg-navy/30" aria-hidden />
        <div className="space-y-1">
          <p className="font-display text-4xl font-bold text-tomato-dark">
            {unknown}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            nochmal
          </p>
        </div>
      </div>
      <button type="button" onClick={onFinish} className="btn-primary">
        Fertig
      </button>
    </section>
  );
}
