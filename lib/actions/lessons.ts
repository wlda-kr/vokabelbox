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

export type CreateLessonResult = { id: string } | { error: string };

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
