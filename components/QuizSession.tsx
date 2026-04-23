"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw, X as XIcon } from "lucide-react";
import { SpeakButton } from "@/components/SpeakButton";
import {
  recordAttempt,
  recordQuizAnswer,
  type Lesson,
  type VocabularyItem,
} from "@/lib/actions/lessons";
import { isAnswerCorrect } from "@/lib/answer-matching";
import { calculateGrade } from "@/lib/grading";

type Direction = "es-de" | "de-es";
export type QuizMode = "quiz" | "test";

const TEST_CAP = 30;

type QueueItem = {
  vocab: VocabularyItem;
  direction: Direction;
};

type CurrentResult = {
  correct: boolean;
  expected: string;
  userAnswer: string;
};

type AnswerLog = {
  vocab_id: string;
  direction: Direction;
  correct: boolean;
  question: string;
  expected: string;
  user_answer: string;
};

type Props = {
  lesson: Lesson;
  vocabulary: VocabularyItem[];
  mode: QuizMode;
};

function shuffle<T>(input: readonly T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQueue(
  vocabulary: VocabularyItem[],
  mode: QuizMode,
): QueueItem[] {
  const shuffled = shuffle(vocabulary);
  const capped =
    mode === "test" ? shuffled.slice(0, Math.min(TEST_CAP, shuffled.length)) : shuffled;
  return capped.map((vocab): QueueItem => ({
    vocab,
    direction: Math.random() < 0.5 ? "es-de" : "de-es",
  }));
}

function questionFor(item: QueueItem): string {
  return item.direction === "es-de"
    ? item.vocab.term_source
    : item.vocab.term_target;
}

function expectedFor(item: QueueItem): string {
  return item.direction === "es-de"
    ? item.vocab.term_target
    : item.vocab.term_source;
}

function directionLabel(direction: Direction): string {
  return direction === "es-de" ? "Spanisch → Deutsch" : "Deutsch → Spanisch";
}

export function QuizSession({ lesson, vocabulary, mode }: Props) {
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CurrentResult | null>(null);
  const [results, setResults] = useState<AnswerLog[]>([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const attemptSavedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQueue(buildQueue(vocabulary, mode));
    setMounted(true);
  }, [vocabulary, mode]);

  useEffect(() => {
    if (!mounted || done || result) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [mounted, currentIndex, result, done]);

  if (!mounted || queue.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <p className="text-sm text-ink-soft">Lade Fragen…</p>
      </main>
    );
  }

  function restart() {
    setQueue(buildQueue(vocabulary, mode));
    setCurrentIndex(0);
    setAnswer("");
    setResult(null);
    setResults([]);
    setDone(false);
    setSaveError(null);
    attemptSavedRef.current = false;
  }

  const current = queue[currentIndex];
  const question = questionFor(current);
  const expected = expectedFor(current);
  const answerLang = current.direction === "es-de" ? "de" : "es";
  const showSpeak = current.direction === "es-de";
  const total = queue.length;
  const position = done ? total : currentIndex + 1;
  const progressPct = Math.round(((done ? total : currentIndex) / total) * 100);

  const correctCount = results.filter((r) => r.correct).length;
  const wrongLogs = results.filter((r) => !r.correct);
  const wrongCount = wrongLogs.length;

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (submitting || result) return;
    const trimmed = answer.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const correct = isAnswerCorrect(trimmed, expected);
    const log: AnswerLog = {
      vocab_id: current.vocab.id,
      direction: current.direction,
      correct,
      question,
      expected,
      user_answer: trimmed,
    };
    setResult({ correct, expected, userAnswer: trimmed });
    setResults((prev) => [...prev, log]);

    const res = await recordQuizAnswer(current.vocab.id, correct);
    if ("error" in res) {
      console.error("recordQuizAnswer failed", res.error);
    }
    setSubmitting(false);
  }

  async function handleContinue() {
    if (!result) return;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      setDone(true);
      if (!attemptSavedRef.current) {
        attemptSavedRef.current = true;
        const finalCorrect = results.filter((r) => r.correct).length;
        const percent = total > 0 ? (finalCorrect / total) * 100 : 0;
        const grade = mode === "test" ? calculateGrade(percent).grade : null;
        const saveResult = await recordAttempt({
          lessonId: lesson.id,
          mode,
          total,
          correct: finalCorrect,
          grade,
          items: results.map((r) => ({
            vocab_id: r.vocab_id,
            correct: r.correct,
            direction: r.direction,
          })),
        });
        if ("error" in saveResult) {
          setSaveError(saveResult.error);
        }
      }
      return;
    }

    setCurrentIndex(nextIndex);
    setAnswer("");
    setResult(null);
  }

  const isLast = currentIndex + 1 >= queue.length;
  const continueLabel = !isLast
    ? "Weiter"
    : mode === "test"
      ? "Test auswerten"
      : "Fertig";

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link
          href={`/lessons/${lesson.id}`}
          className="btn-ghost text-sm -ml-3"
        >
          <ArrowLeft size={16} />
          Abbrechen
        </Link>
        <span className="text-sm font-bold tabular-nums">
          {position} / {total}
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

      {done ? (
        mode === "test" ? (
          <TestDoneCard
            lessonId={lesson.id}
            total={total}
            correct={correctCount}
            wrong={wrongCount}
            wrongLogs={wrongLogs}
            onRestart={restart}
            saveError={saveError}
          />
        ) : (
          <QuizDoneCard
            lessonId={lesson.id}
            total={total}
            correct={correctCount}
            wrong={wrongCount}
            onRestart={restart}
            saveError={saveError}
          />
        )
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {directionLabel(current.direction)}
            </p>
            {showSpeak && <SpeakButton text={current.vocab.term_source} />}
          </div>

          <p className="font-display text-3xl md:text-4xl font-bold leading-tight">
            {question}
          </p>

          <div className="space-y-2">
            <label htmlFor="answer" className="sr-only">
              Deine Antwort
            </label>
            <input
              ref={inputRef}
              id="answer"
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Deine Antwort…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              lang={answerLang}
              disabled={!!result || submitting}
              className="input-bold disabled:bg-cream disabled:text-ink-soft"
            />
          </div>

          {result ? (
            <ResultBox result={result} />
          ) : (
            <button
              type="submit"
              disabled={submitting || !answer.trim()}
              className="btn-primary w-full"
            >
              {submitting ? "Prüfe…" : "Prüfen"}
            </button>
          )}

          {result && (
            <button
              type="button"
              onClick={handleContinue}
              className="btn-primary w-full"
            >
              {continueLabel}
            </button>
          )}
        </form>
      )}
    </main>
  );
}

function ResultBox({ result }: { result: CurrentResult }) {
  if (result.correct) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border-2 border-teal bg-teal/15 p-3 text-sm font-medium text-teal-dark"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-paper">
          <Check size={14} />
        </span>
        <div>
          <p className="font-bold">Richtig!</p>
          <p className="text-xs opacity-80">
            Deine Antwort: „{result.userAnswer}"
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border-2 border-tomato bg-tomato/10 p-3 text-sm font-medium text-tomato-dark"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tomato text-paper">
        <XIcon size={14} />
      </span>
      <div className="space-y-1">
        <p className="font-bold">Leider falsch.</p>
        <p className="text-xs">Deine Antwort: „{result.userAnswer}"</p>
        <p className="text-xs">
          Richtig wäre: <span className="font-bold">„{result.expected}"</span>
        </p>
      </div>
    </div>
  );
}

function QuizDoneCard({
  lessonId,
  total,
  correct,
  wrong,
  onRestart,
  saveError,
}: {
  lessonId: string;
  total: number;
  correct: number;
  wrong: number;
  onRestart: () => void;
  saveError: string | null;
}) {
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <section className="card space-y-6 text-center py-8">
      <h2 className="font-display text-3xl font-bold -rotate-1">Fertig!</h2>
      <StatsRow correct={correct} wrong={wrong} percent={percent} />
      {saveError && (
        <p className="text-xs text-tomato-dark">
          Ergebnis konnte nicht gespeichert werden: {saveError}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={onRestart} className="btn-primary">
          <RotateCcw size={16} />
          Nochmal
        </button>
        <Link href={`/lessons/${lessonId}`} className="btn-ghost bg-paper">
          Zurück zur Lektion
        </Link>
      </div>
    </section>
  );
}

function TestDoneCard({
  lessonId,
  total,
  correct,
  wrong,
  wrongLogs,
  onRestart,
  saveError,
}: {
  lessonId: string;
  total: number;
  correct: number;
  wrong: number;
  wrongLogs: AnswerLog[];
  onRestart: () => void;
  saveError: string | null;
}) {
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const { grade, label } = calculateGrade(percent);

  return (
    <section className="space-y-6">
      <div className="card bg-sunshine text-center space-y-4 py-8">
        <p className="text-xs font-bold uppercase tracking-wide text-navy/70">
          Deine Note
        </p>
        <div className="flex items-baseline justify-center gap-3">
          <span className="font-display text-7xl font-bold leading-none">
            {grade}
          </span>
          <span className="font-display text-2xl font-bold">{label}</span>
        </div>
        <StatsRow correct={correct} wrong={wrong} percent={percent} />
      </div>

      {wrongLogs.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-display text-lg font-bold">Nacharbeiten</h3>
          <ul className="space-y-2">
            {wrongLogs.map((log, index) => (
              <li
                key={`${log.vocab_id}-${index}`}
                className="rounded-lg border-2 border-navy/20 bg-cream p-3 text-sm"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {directionLabel(log.direction)}
                </p>
                <p className="mt-1">
                  <span className="italic font-medium text-tomato-dark">
                    {log.question}
                  </span>
                  {" → "}
                  <span className="font-bold">{log.expected}</span>
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Du hast getippt: „{log.user_answer}"
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveError && (
        <p className="text-xs text-tomato-dark">
          Ergebnis konnte nicht gespeichert werden: {saveError}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={onRestart} className="btn-primary">
          <RotateCcw size={16} />
          Nochmal
        </button>
        <Link href={`/lessons/${lessonId}`} className="btn-ghost bg-paper">
          Zurück zur Lektion
        </Link>
      </div>
    </section>
  );
}

function StatsRow({
  correct,
  wrong,
  percent,
}: {
  correct: number;
  wrong: number;
  percent: number;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <Stat value={correct} label="richtig" color="text-teal-dark" />
      <span aria-hidden className="h-10 w-px bg-navy/30" />
      <Stat value={wrong} label="falsch" color="text-tomato-dark" />
      <span aria-hidden className="h-10 w-px bg-navy/30" />
      <Stat value={`${percent}%`} label="Quote" color="text-navy" />
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <p className={`font-display text-4xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </p>
    </div>
  );
}
