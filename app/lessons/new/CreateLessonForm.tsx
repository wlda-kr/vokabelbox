"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Plus, X } from "lucide-react";
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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lessonName, setLessonName] = useState("");
  const [pairs, setPairs] = useState<EditablePair[]>([]);
  const keyCounter = useRef(0);
  const [saving, setSaving] = useState(false);

  function makePair(source = "", target = ""): EditablePair {
    keyCounter.current += 1;
    return { key: keyCounter.current, source, target };
  }

  function addFiles(incoming: File[]) {
    const imagesOnly = incoming.filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...imagesOnly].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
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
      <div className="card text-center py-12 space-y-5">
        <div className="relative mx-auto h-20 w-20">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-navy border-t-transparent" />
          <div className="absolute inset-3 rounded-full bg-sunshine border-2 border-navy" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold">
            Claude liest die Seite…
          </h2>
          <p className="text-sm text-ink-soft">
            Das dauert meist 5–15 Sekunden.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-6 pb-28">
        <div className="space-y-2">
          <label htmlFor="lesson-name" className="block text-sm font-bold">
            Lektionsname
          </label>
          <input
            id="lesson-name"
            type="text"
            value={lessonName}
            onChange={(event) => setLessonName(event.target.value)}
            placeholder="z.B. Unidad 6 - Kleidung"
            maxLength={120}
            className="input-bold font-display text-xl font-bold"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Vokabeln</h2>
            <span className="text-sm text-ink-soft">
              {validPairCount}{" "}
              {validPairCount === 1 ? "Paar" : "Paare"} bereit
            </span>
          </div>

          <ul className="space-y-2">
            {pairs.map((pair) => (
              <li
                key={pair.key}
                className="card-flat flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
              >
                <input
                  type="text"
                  value={pair.source}
                  onChange={(event) =>
                    updatePair(pair.key, "source", event.target.value)
                  }
                  placeholder="la casa"
                  className="input-bold flex-1 italic font-medium text-tomato-dark"
                />
                <input
                  type="text"
                  value={pair.target}
                  onChange={(event) =>
                    updatePair(pair.key, "target", event.target.value)
                  }
                  placeholder="das Haus"
                  className="input-bold flex-1"
                />
                <button
                  type="button"
                  onClick={() => removePair(pair.key)}
                  aria-label="Zeile löschen"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-coral text-paper shadow-pop-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-pop active:translate-x-px active:translate-y-px active:shadow-none self-end sm:self-auto"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addPair}
            className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy bg-transparent font-bold text-navy hover:bg-paper transition-colors"
          >
            <Plus size={18} />
            Zeile hinzufügen
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border-2 border-tomato bg-tomato/10 p-3 text-sm font-medium text-tomato-dark"
          >
            {error}
          </div>
        )}

        <div className="fixed bottom-4 left-4 right-4 z-10 mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3 rounded-full border-2 border-navy bg-paper px-3 py-2 shadow-pop-lg">
            <span className="pl-3 text-sm font-bold">
              {validPairCount}{" "}
              {validPairCount === 1 ? "Vokabel" : "Vokabeln"}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="btn-primary"
            >
              {saving ? "Speichere…" : "Lektion speichern"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "upload"
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Mach Fotos der Vokabelseite(n). Claude extrahiert die Paare, du
        kontrollierst im nächsten Schritt.
      </p>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragActive
            ? "border-tomato bg-tomato/10"
            : "border-navy bg-paper hover:bg-cream"
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy bg-sunshine">
          <Camera aria-hidden size={24} className="text-navy" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-lg font-bold">
            Foto(s) hier ablegen
          </p>
          <p className="text-sm text-ink-soft">
            oder tippen zum Auswählen
          </p>
          <p className="text-xs text-ink-soft">Bis zu 5 Bilder</p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
        className="hidden"
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="chip max-w-full"
            >
              <span className="max-w-[180px] truncate font-medium">
                {file.name}
              </span>
              <span className="text-xs text-ink-soft">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`${file.name} entfernen`}
                className="text-tomato hover:text-tomato-dark"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border-2 border-tomato bg-tomato/10 p-3 text-sm font-medium text-tomato-dark"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleExtract}
        disabled={files.length === 0}
        className="btn-primary w-full"
      >
        Vokabeln extrahieren
      </button>
    </div>
  );
}
