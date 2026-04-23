"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDue } from "@/lib/leitner";
import type { AnswerResult } from "@/lib/answer-matching";

export type LessonSummary = {
  id: string;
  name: string;
  created_at: string;
  vocab_count: number;
};

export type Lesson = {
  id: string;
  name: string;
  language_from: string;
  language_to: string;
  created_at: string;
};

export type VocabularyItem = {
  id: string;
  lesson_id: string;
  term_source: string;
  term_target: string;
  box: number;
  correct_count: number;
  wrong_count: number;
  position: number;
  last_review: string | null;
};

export type GetLessonResult =
  | { lesson: Lesson; vocabulary: VocabularyItem[] }
  | { error: string };

export type CreateLessonResult = { id: string } | { error: string };

export type UpdateVocabResult = { box: number } | { error: string };

export type DeleteLessonResult = { ok: true } | { error: string };

export type AttemptMode = "learn" | "quiz" | "test" | "weak";
export type AttemptDirection = "es-de" | "de-es";

export type AttemptItem = {
  vocab_id: string;
  result: AnswerResult;
  direction: AttemptDirection;
};

export type RecordAttemptInput = {
  lessonId: string;
  mode: AttemptMode;
  total: number;
  correct: number;
  grade: number | null;
  items: AttemptItem[];
};

export type RecordAttemptResult = { ok: true } | { error: string };

export type DueVocabularyItem = VocabularyItem & { lesson_name: string };

export type DueCount = { total: number; lessonCount: number };

type PairInput = { source: string; target: string };

export async function createLesson(
  name: string,
  pairs: PairInput[],
): Promise<CreateLessonResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Nicht eingeloggt." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Lektionsname darf nicht leer sein." };
  }
  if (trimmedName.length > 120) {
    return { error: "Lektionsname darf höchstens 120 Zeichen haben." };
  }

  const cleanedPairs = pairs
    .map((pair) => ({
      source: pair.source.trim(),
      target: pair.target.trim(),
    }))
    .filter((pair) => pair.source && pair.target);

  if (cleanedPairs.length === 0) {
    return { error: "Mindestens ein vollständiges Vokabelpaar ist nötig." };
  }

  const admin = createAdminClient();

  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .insert({
      user_id: user.id,
      name: trimmedName,
      language_from: "es",
      language_to: "de",
    })
    .select("id")
    .single();

  if (lessonError || !lesson) {
    console.error("createLesson: lesson insert failed", lessonError);
    return {
      error: lessonError?.message ?? "Lektion konnte nicht angelegt werden.",
    };
  }

  const lessonId = lesson.id as string;

  const vocabRows = cleanedPairs.map((pair, index) => ({
    lesson_id: lessonId,
    term_source: pair.source,
    term_target: pair.target,
    position: index,
  }));

  const { error: vocabError } = await admin
    .from("vocabulary")
    .insert(vocabRows);

  if (vocabError) {
    console.error("createLesson: vocabulary insert failed", vocabError);
    // Rollback: Lektion ohne Vokabeln wollen wir nicht stehen lassen.
    await admin.from("lessons").delete().eq("id", lessonId);
    return { error: vocabError.message };
  }

  revalidatePath("/");
  return { id: lessonId };
}

export async function listLessons(): Promise<LessonSummary[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("lessons")
    .select("id, name, created_at, vocabulary(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("listLessons failed", error);
    return [];
  }

  return data.map((row) => {
    const vocab = row.vocabulary as Array<{ count: number }> | null;
    return {
      id: row.id as string,
      name: row.name as string,
      created_at: row.created_at as string,
      vocab_count: vocab?.[0]?.count ?? 0,
    };
  });
}

export async function getLesson(id: string): Promise<GetLessonResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht eingeloggt." };

  const admin = createAdminClient();

  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, name, language_from, language_to, created_at, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lessonError) {
    console.error("getLesson: lesson query failed", lessonError);
    return { error: lessonError.message };
  }
  if (!lesson) {
    return { error: "not_found" };
  }

  const { data: vocab, error: vocabError } = await admin
    .from("vocabulary")
    .select(
      "id, lesson_id, term_source, term_target, box, correct_count, wrong_count, position, last_review",
    )
    .eq("lesson_id", id)
    .order("position", { ascending: true });

  if (vocabError) {
    console.error("getLesson: vocabulary query failed", vocabError);
    return { error: vocabError.message };
  }

  return {
    lesson: {
      id: lesson.id as string,
      name: lesson.name as string,
      language_from: lesson.language_from as string,
      language_to: lesson.language_to as string,
      created_at: lesson.created_at as string,
    },
    vocabulary: (vocab ?? []) as VocabularyItem[],
  };
}

export async function updateVocabularyReview(
  vocabId: string,
  known: boolean,
): Promise<UpdateVocabResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht eingeloggt." };

  const admin = createAdminClient();

  const { data: vocab, error: fetchError } = await admin
    .from("vocabulary")
    .select("id, lesson_id, box, correct_count, wrong_count")
    .eq("id", vocabId)
    .maybeSingle();

  if (fetchError) {
    console.error("updateVocabularyReview: fetch failed", fetchError);
    return { error: fetchError.message };
  }
  if (!vocab) {
    return { error: "Vokabel nicht gefunden." };
  }

  const { data: lesson, error: ownerError } = await admin
    .from("lessons")
    .select("user_id")
    .eq("id", vocab.lesson_id as string)
    .maybeSingle();

  if (ownerError || !lesson || lesson.user_id !== user.id) {
    return { error: "Keine Berechtigung." };
  }

  const currentBox = vocab.box as number;
  const currentCorrect = vocab.correct_count as number;
  const currentWrong = vocab.wrong_count as number;

  const newBox = known ? Math.min(currentBox + 1, 5) : 1;
  const newCorrect = known ? currentCorrect + 1 : currentCorrect;
  const newWrong = known ? currentWrong : currentWrong + 1;

  const { data: updated, error: updateError } = await admin
    .from("vocabulary")
    .update({
      box: newBox,
      correct_count: newCorrect,
      wrong_count: newWrong,
      last_review: new Date().toISOString(),
    })
    .eq("id", vocabId)
    .select("box")
    .single();

  if (updateError || !updated) {
    console.error("updateVocabularyReview: update failed", updateError);
    return {
      error: updateError?.message ?? "Update fehlgeschlagen.",
    };
  }

  return { box: updated.box as number };
}

export async function recordQuizAnswer(
  vocabId: string,
  result: AnswerResult,
): Promise<UpdateVocabResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht eingeloggt." };

  const admin = createAdminClient();

  const { data: vocab, error: fetchError } = await admin
    .from("vocabulary")
    .select("id, lesson_id, box, correct_count, wrong_count")
    .eq("id", vocabId)
    .maybeSingle();

  if (fetchError) {
    console.error("recordQuizAnswer: fetch failed", fetchError);
    return { error: fetchError.message };
  }
  if (!vocab) {
    return { error: "Vokabel nicht gefunden." };
  }

  const { data: lesson, error: ownerError } = await admin
    .from("lessons")
    .select("user_id")
    .eq("id", vocab.lesson_id as string)
    .maybeSingle();

  if (ownerError || !lesson || lesson.user_id !== user.id) {
    return { error: "Keine Berechtigung." };
  }

  const currentBox = vocab.box as number;
  const currentCorrect = vocab.correct_count as number;
  const currentWrong = vocab.wrong_count as number;

  let newBox = currentBox;
  let newCorrect = currentCorrect;
  let newWrong = currentWrong;

  if (result === "correct") {
    newBox = Math.min(currentBox + 1, 5);
    newCorrect = currentCorrect + 1;
  } else if (result === "wrong") {
    newBox = Math.max(currentBox - 1, 1);
    newWrong = currentWrong + 1;
  }
  // "almost": Box bleibt, keine Zähler.

  const { data: updated, error: updateError } = await admin
    .from("vocabulary")
    .update({
      box: newBox,
      correct_count: newCorrect,
      wrong_count: newWrong,
      last_review: new Date().toISOString(),
    })
    .eq("id", vocabId)
    .select("box")
    .single();

  if (updateError || !updated) {
    console.error("recordQuizAnswer: update failed", updateError);
    return {
      error: updateError?.message ?? "Update fehlgeschlagen.",
    };
  }

  return { box: updated.box as number };
}

export async function recordAttempt(
  input: RecordAttemptInput,
): Promise<RecordAttemptResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht eingeloggt." };

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("attempts").insert({
    user_id: user.id,
    lesson_id: input.lessonId,
    mode: input.mode,
    total: input.total,
    correct: input.correct,
    grade: input.grade,
    items: input.items,
  });

  if (insertError) {
    console.error("recordAttempt: insert failed", insertError);
    return { error: insertError.message };
  }

  return { ok: true };
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function getDueVocabulary(
  limit = 30,
): Promise<DueVocabularyItem[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("vocabulary")
    .select(
      "id, lesson_id, term_source, term_target, box, correct_count, wrong_count, position, last_review, lessons!inner(name, user_id)",
    )
    .eq("lessons.user_id", user.id);

  if (error || !data) {
    if (error) console.error("getDueVocabulary failed", error);
    return [];
  }

  const all: DueVocabularyItem[] = data.map((row) => {
    const lesson = row.lessons as unknown as { name: string };
    return {
      id: row.id as string,
      lesson_id: row.lesson_id as string,
      term_source: row.term_source as string,
      term_target: row.term_target as string,
      box: row.box as number,
      correct_count: row.correct_count as number,
      wrong_count: row.wrong_count as number,
      position: row.position as number,
      last_review: row.last_review as string | null,
      lesson_name: lesson?.name ?? "",
    };
  });

  const due = all.filter((v) => isDue(v.box, v.last_review));

  const highPriority = due.filter((v) => v.box <= 2);
  const lowPriority = due.filter((v) => v.box > 2);
  shuffleInPlace(highPriority);
  shuffleInPlace(lowPriority);

  return [...highPriority, ...lowPriority].slice(0, limit);
}

export async function getDueCount(): Promise<DueCount> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { total: 0, lessonCount: 0 };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("vocabulary")
    .select("lesson_id, box, last_review, lessons!inner(user_id)")
    .eq("lessons.user_id", user.id);

  if (error || !data) {
    if (error) console.error("getDueCount failed", error);
    return { total: 0, lessonCount: 0 };
  }

  const due = data.filter((row) =>
    isDue(row.box as number, row.last_review as string | null),
  );
  const lessonIds = new Set(due.map((row) => row.lesson_id as string));
  return { total: due.length, lessonCount: lessonIds.size };
}

export async function deleteLesson(id: string): Promise<DeleteLessonResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht eingeloggt." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("lessons")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteLesson failed", error);
    return { error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}
