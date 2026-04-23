"use client";

import Link from "next/link";
import { useState } from "react";

type VocabPair = { source: string; target: string };

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

export default function TestOcrPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<VocabPair[] | null>(null);
  const [suggestedName, setSuggestedName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setLoading(true);
    setError(null);
    setPairs(null);
    setSuggestedName("");

    try {
      const images = await Promise.all(files.map(fileToBase64));
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });

      let payload: {
        suggestedName?: string;
        pairs?: VocabPair[];
        error?: string;
        message?: string;
      };
      try {
        payload = await res.json();
      } catch {
        throw new Error(`Antwort vom Server ist kein JSON (Status ${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(
          payload.message || payload.error || `Fehler (Status ${res.status}).`,
        );
      }

      setSuggestedName(payload.suggestedName ?? "");
      setPairs(payload.pairs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <Link
        href="/"
        className="inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Zurück
      </Link>

      <h1 className="text-2xl font-semibold">OCR-Test</h1>

      <div className="space-y-3">
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(event) =>
            setFiles(Array.from(event.target.files ?? []))
          }
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

        <button
          type="button"
          onClick={handleExtract}
          disabled={files.length === 0 || loading}
          className="min-h-[44px] rounded-md bg-gray-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
        >
          Extrahieren
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-700">
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
          />
          Claude liest die Seite…
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {pairs && (
        <section className="space-y-3">
          {suggestedName && (
            <p className="text-sm text-gray-700">
              Vorgeschlagener Name:{" "}
              <span className="font-medium">{suggestedName}</span>
            </p>
          )}
          <p className="text-sm font-medium">
            {pairs.length} Vokabeln gefunden
          </p>
          {pairs.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-2 text-left font-medium">Spanisch</th>
                  <th className="py-2 text-left font-medium">Deutsch</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 pr-4 align-top">{pair.source}</td>
                    <td className="py-2 align-top">{pair.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
