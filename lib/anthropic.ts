import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export type VocabPair = {
  source: string;
  target: string;
};

export type ExtractionResult = {
  suggestedName: string;
  pairs: VocabPair[];
};

type ImageInput = {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

const EXTRACTION_PROMPT = `Du analysierst Fotos einer Vokabelseite aus einem Schulbuch (Spanisch-Deutsch).

Extrahiere ALLE Vokabelpaare von der/den Seiten. Regeln:
- Spanische Artikel (el, la, los, las) mit aufnehmen
- Deutsche Artikel (der, die, das) mit aufnehmen
- Verben im Infinitiv belassen
- Bei Synonymen/Alternativen: mit ' / ' trennen
- Keine Beispielsätze, nur Vokabelpaare
- Reihenfolge wie im Buch beibehalten
- Bei mehreren Fotos: alle Seiten zusammenfassen, keine Duplikate

Schlage außerdem einen kurzen, prägnanten Lektionsnamen auf Deutsch vor, basierend auf der Buchseite. Format z.B. 'Unidad 6 - Kleidung' oder 'Lektion 3 - Im Restaurant'. Schau nach Kapitelnummern und Überschriften auf dem Foto.

Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown-Codeblöcke, ohne Erklärung, in diesem Format:
{"suggestedName": "...", "pairs": [{"source": "la casa", "target": "das Haus"}, ...]}`;

export async function extractVocabularyFromImages(
  images: ImageInput[],
): Promise<ExtractionResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: img.mediaType,
              data: img.data,
            },
          })),
          { type: "text" as const, text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );

  if (!textBlock) {
    throw new Error("Claude lieferte keine Textantwort zurück.");
  }

  const rawText = textBlock.text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const snippet = rawText.slice(0, 200);
    throw new Error(
      `Antwort ist kein gültiges JSON. Erste 200 Zeichen: ${snippet}`,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { pairs?: unknown }).pairs)
  ) {
    const snippet = rawText.slice(0, 200);
    throw new Error(
      `JSON enthält kein pairs-Array. Erste 200 Zeichen: ${snippet}`,
    );
  }

  const obj = parsed as { suggestedName?: unknown; pairs: VocabPair[] };
  const suggestedName =
    typeof obj.suggestedName === "string" ? obj.suggestedName : "";

  return {
    suggestedName,
    pairs: obj.pairs,
  };
}
