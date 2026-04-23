import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export type VocabPair = {
  source: string;
  target: string;
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

Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown-Codeblöcke, ohne Erklärung, in diesem Format:
{"pairs": [{"source": "la casa", "target": "das Haus"}, ...]}`;

export async function extractVocabularyFromImages(
  images: ImageInput[],
): Promise<VocabPair[]> {
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

  return (parsed as { pairs: VocabPair[] }).pairs;
}
