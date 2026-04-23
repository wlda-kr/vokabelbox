"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createLesson } from "@/lib/actions/lessons";

type Phase = "upload" | "loading" | "review";

type EditablePair = {
  key: number;
  source: string;
  target: string;
};

async function fileToBase64(
  file: File,
): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader lieferte kein string-Ergebnis."));
        return;
      }
      const comma = result.indexOf(",");
      const data = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ data, mediaType: file.type });
    };
    reader.readAsDataURL(file);
  });
}

export function CreateLessonForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [lessonName, setLessonName] = useState("");
  const [pairs, setPairs] = useState<EditablePair[]>([]);
  const keyCounter = useRef(0);
  const [saving, setSaving] = useState(false);

  function makePair(source = "", target = ""): EditablePair {
    keyCounter.current += 1;
    return { key: keyCounter.current, source, target };
  }

  async function handleExtract() {
    if (files.length === 0) return;
    setError(null);
    setPhase("loading");

    try {
      const images = await Promise.all(files.map(fileToBase64));
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });

      let payload: {
        suggestedName?: string;
        pairs?: Array<{ source: string; target: string }>;
        error?: string;
        message?: string;
      };
      try {
        payload = await res.json();
      } catch {
        throw new Error(
          `Antwort vom Server ist kein JSON (Status ${res.status}).`,
        );
      }

      if (!res.ok) {
        throw new Error(
          payload.message ||
            payload.error ||
            `Extraktion fehlgeschlagen (Status ${res.status}).`,
        );
      }

      const extractedPairs = payload.pairs ?? [];
      setLessonName(payload.suggestedName ?? "");
      setPairs(
        extractedPairs.length > 0
          ? extractedPairs.map((p) => makePair(p.source, p.target))
          : [makePair()],
      );
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("upload");
    }
  }

  function updatePair(key: number, field: "source" | "target", value: string) {
    setPairs((current) =>
      current.map((pair) =>
        pair.key === key ? { ...pair, [field]: value } : pair,
      ),
    );
  }

  function removePair(key: number) {
    setPairs((current) => current.filter((pair) => pair.key !== key));
  }

  function addPair() {
    setPairs((current) => [...current, makePair()]);
  }

  const nameValid = lessonName.trim().length > 0;
  const validPairCount = useMemo(
    () =>
      pairs.filter((pair) => pair.source.trim() && pair.target.trim()).length,
    [pairs],
  );
  const canSave = nameValid && validPairCount > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);

    const cleaned = pairs
      .map((pair) => ({
        source: pair.source.trim(),
        target: pair.target.trim(),
      }))
      .filter((pair) => pair.source && pair.target);

    const result = await createLesson(lessonName.trim(), cleaned);

    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
        <span
          aria-hidden
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
        />
        Claude liest die Seite…
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="lesson-name"
            className="block text-sm font-medium"
          >
            Lektionsname
          </label>
          <input
            id="lesson-name"
            type="text"
            value={lessonName}
            onChange={(event) => setLessonName(event.target.value)}
            className="block w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none"
            placeholder="z.B. Unidad 6 - Kleidung"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_44px] gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Spanisch</span>
            <span>Deutsch</span>
            <span className="sr-only">Aktion</span>
          </div>

          <ul className="space-y-2">
            {pairs.map((pair) => (
              <li
                key={pair.key}
                className="grid grid-cols-[1fr_1fr_44px] gap-2"
              >
                <input
                  type="text"
                  value={pair.source}
                  onChange={(event) =>
                    updatePair(pair.key, "source", event.target.value)
                  }
                  placeholder="la casa"
                  className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none"
                />
                <input
                  type="text"
                  value={pair.target}
                  onChange={(event) =>
                    updatePair(pair.key, "target", event.target.value)
                  }
                  placeholder="das Haus"
                  className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base focus:border-gray-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removePair(pair.key)}
                  aria-label="Zeile löschen"
                  className="flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addPair}
            className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            + Zeile hinzufügen
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-600">
            {validPairCount}{" "}
            {validPairCount === 1 ? "Vokabel" : "Vokabeln"} bereit
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="min-h-[44px] rounded-md bg-gray-900 px-5 py-2 text-base font-medium text-white disabled:opacity-50"
          >
            {saving ? "Speichere…" : "Lektion speichern"}
          </button>
        </div>
      </div>
    );
  }

  // phase === "upload"
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Mach Fotos der Vokabelseite(n) und lass Claude die Paare extrahieren.
        Du kannst sie im nächsten Schritt noch korrigieren.
      </p>

      <input
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        className="block text-sm"
      />

      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-gray-700">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              {file.name} — {(file.size / 1024).toFixed(1)} KB
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleExtract}
        disabled={files.length === 0}
        className="min-h-[44px] rounded-md bg-gray-900 px-5 py-2 text-base font-medium text-white disabled:opacity-50"
      >
        Vokabeln extrahieren
      </button>
    </div>
  );
}
