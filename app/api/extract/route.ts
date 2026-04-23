import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { extractVocabularyFromImages } from "@/lib/anthropic";

const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const MAX_IMAGES = 5;
const MAX_BASE64_LENGTH = 7_000_000;

type ValidImage = { data: string; mediaType: AllowedMediaType };

function isAllowedMediaType(value: string): value is AllowedMediaType {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Body ist kein gültiges JSON." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { images?: unknown }).images)
  ) {
    return NextResponse.json(
      { error: "invalid_body", message: "Feld 'images' muss ein Array sein." },
      { status: 400 },
    );
  }

  const rawImages = (body as { images: unknown[] }).images;

  if (rawImages.length < 1 || rawImages.length > MAX_IMAGES) {
    return NextResponse.json(
      {
        error: "invalid_images",
        message: `Es sind zwischen 1 und ${MAX_IMAGES} Bilder erlaubt.`,
      },
      { status: 400 },
    );
  }

  const images: ValidImage[] = [];
  for (let i = 0; i < rawImages.length; i++) {
    const img = rawImages[i];
    if (
      typeof img !== "object" ||
      img === null ||
      typeof (img as { data?: unknown }).data !== "string" ||
      typeof (img as { mediaType?: unknown }).mediaType !== "string"
    ) {
      return NextResponse.json(
        {
          error: "invalid_image",
          message: `Bild ${i} braucht 'data' (string) und 'mediaType' (string).`,
        },
        { status: 400 },
      );
    }

    const { data, mediaType } = img as { data: string; mediaType: string };

    if (!isAllowedMediaType(mediaType)) {
      return NextResponse.json(
        {
          error: "invalid_media_type",
          message: `Bild ${i}: Typ '${mediaType}' nicht erlaubt. Zulässig: ${ALLOWED_MEDIA_TYPES.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    if (data.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        {
          error: "image_too_large",
          message: `Bild ${i} ist zu groß (max. ca. 5 MB pro Bild).`,
        },
        { status: 400 },
      );
    }

    images.push({ data, mediaType });
  }

  try {
    const result = await extractVocabularyFromImages(images);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("extract route failed:", err);
    const message =
      err instanceof Anthropic.APIError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unbekannter Fehler";
    return NextResponse.json(
      { error: "extraction_failed", message },
      { status: 502 },
    );
  }
}
