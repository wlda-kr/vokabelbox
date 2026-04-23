"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
        className="inline-flex items-center gap-1.5 text-sm font-bold text-tomato hover:text-tomato-dark disabled:opacity-50"
      >
        <Trash2 aria-hidden size={14} />
        {loading ? "Lösche…" : "Lektion löschen"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-tomato-dark">
          {error}
        </p>
      )}
    </div>
  );
}
