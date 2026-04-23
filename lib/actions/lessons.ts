"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
