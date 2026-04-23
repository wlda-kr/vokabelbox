"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SpeakButton } from "@/components/SpeakButton";
import {
  updateVocabularyReview,
  type VocabularyItem,
} from "@/lib/actions/lessons";

function shuffle<T>(input: readonly T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Props = {
  lessonId: string;
  vocabulary: VocabularyItem[];
};

export function LearnSession({ lessonId, vocabulary }: Props) {
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ known: 0, unknown: 0 });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQueue(shuffle(vocabulary));
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
        <p className="text-sm text-gray-600">Lade Lernkarten…</p>
      </main>
    );
  }

  function restart() {
    setQueue(shuffle(vocabulary));
    setCurrentIndex(0);
    setFlipped(false);
    setResults({ known: 0, unknown: 0 });
    setDone(false);
    setError(null);
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
      // Fortschritt nicht blockieren — trotzdem zur nächsten Karte.
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

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link
          href={`/lessons/${lessonId}`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Abbrechen
        </Link>
        <span className="text-sm text-gray-600 tabular-nums">
          {position} / {total}
        </span>
      </header>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        aria-label="Fortschritt"
      >
        <div
          className="h-full rounded-full bg-gray-900 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {done ? (
        <section className="space-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
          <h2 className="text-xl font-semibold">Super gemacht!</h2>
          <p className="text-sm text-gray-700">
            {results.known} gekannt · {results.unknown} nochmal üben
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={restart}
              className="min-h-[44px] rounded-md bg-gray-900 px-5 py-2 text-base font-medium text-white"
            >
              Nochmal
            </button>
            <Link
              href={`/lessons/${lessonId}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 px-5 py-2 text-base font-medium"
            >
              Zurück zur Lektion
            </Link>
          </div>
        </section>
      ) : (
        <>
          <Card
            item={queue[currentIndex]}
            flipped={flipped}
            onFlip={() => setFlipped((prev) => !prev)}
          />

          {flipped && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleAnswer(false)}
                disabled={submitting}
                className="min-h-[56px] rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Nochmal üben
              </button>
              <button
                type="button"
                onClick={() => handleAnswer(true)}
                disabled={submitting}
                className="min-h-[56px] rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Kann ich
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Card({
  item,
  flipped,
  onFlip,
}: {
  item: VocabularyItem;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFlip}
      className="relative flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-gray-300 bg-white p-6 text-center shadow-sm hover:shadow"
    >
      <p className="text-2xl font-semibold">
        {flipped ? item.term_target : item.term_source}
      </p>

      {!flipped && (
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-gray-500">
          Tippen zum Umdrehen
        </p>
      )}

      {!flipped && (
        <div className="absolute bottom-2 right-2">
          <SpeakButton text={item.term_source} />
        </div>
      )}
    </button>
  );
}
