"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLesson } from "@/lib/actions/lessons";

type Props = {
  lessonId: string;
  lessonName: string;
};

export function DeleteLessonButton({ lessonId, lessonName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const ok = window.confirm(
      `"${lessonName}" wirklich löschen? Alle Vokabeln gehen dabei verloren.`,
    );
    if (!ok) return;

    setLoading(true);
    setError(null);
    const result = await deleteLesson(lessonId);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {loading ? "Lösche…" : "Lektion löschen"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
