const PUNCTUATION_RE = /[.,;!?¡¿]/g;
const WHITESPACE_RE = /\s+/g;
const HYPHEN_WHITESPACE_RE = /[-\s]+/g;
const DIACRITICS_RE = /[\u0300-\u036f]/g;
const LEADING_ARTICLE_RE =
  /^(el|la|los|las|un|una|der|die|das|ein|eine)\s+/i;
const GENDER_SUFFIX_RE = /^(\w+),-(\w+)$/;
const TRAILING_VOWEL_RE = /[aeiouáéíóú]$/i;

export type AnswerResult = "correct" | "almost" | "wrong";

// Streng: lowercase + trim + Punctuation weg + Whitespace zusammengefasst.
// Behält Diakritika und Bindestriche.
function strictNormalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(PUNCTUATION_RE, "")
    .replace(WHITESPACE_RE, " ")
    .trim();
}

// Großzügig: strict + Diakritika weg + Bindestriche/Spaces vereinheitlicht.
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(PUNCTUATION_RE, "")
    .replace(HYPHEN_WHITESPACE_RE, " ")
    .trim();
}

export function stripArticle(input: string): string {
  return input.replace(LEADING_ARTICLE_RE, "");
}

function hasArticlePrefix(input: string): boolean {
  return LEADING_ARTICLE_RE.test(input);
}

/**
 * Nimmt die erwartete Antwort und erzeugt alle akzeptablen Schreibweisen.
 * Deckt Schulbuch-Notationen ab:
 *
 *   "caro,-a"              → caro, cara, caro/cara, …
 *   "guapo,-a"             → guapo, guapa, …
 *   "el alumno, la alumna" → el alumno, la alumna, alumno, alumna, …
 *   "feliz / contento"     → feliz, contento, feliz/contento, …
 *   "der Badeanzug / die Badehose"
 *                          → der Badeanzug, Badeanzug, die Badehose, Badehose, …
 *   "caro"                 → caro
 *
 * Kritisch: Kommas ohne Artikel werden NICHT aufgesplittet — das ist der
 * Unterschied zur früheren Logik, die "caro,-a" zerhackt hat.
 */
export function expandVariants(expected: string): string[] {
  const trimmed = expected.trim();
  const variants = new Set<string>();
  if (trimmed) variants.add(trimmed);

  // Fall 1: Gender-Suffix-Notation "caro,-a" → caro/cara.
  const genderMatch = trimmed.match(GENDER_SUFFIX_RE);
  if (genderMatch) {
    const base = genderMatch[1];
    const suffix = genderMatch[2];
    const female = TRAILING_VOWEL_RE.test(base)
      ? base.replace(TRAILING_VOWEL_RE, suffix)
      : base + suffix;
    variants.add(base);
    variants.add(female);
    variants.add(`${base}/${female}`);
    variants.add(`${base} / ${female}`);
    variants.add(`${base}, ${female}`);
    return Array.from(variants);
  }

  // Fall 2: Synonyme mit "/" als Trenner.
  if (trimmed.includes("/")) {
    const parts = trimmed
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const stripped = parts.map((p) => stripArticle(p));
      for (const part of parts) variants.add(part);
      for (const s of stripped) variants.add(s);
      variants.add(stripped.join("/"));
      variants.add(stripped.join(", "));
      return Array.from(variants);
    }
  }

  // Fall 3: Komma-separiert MIT Artikeln an jedem Teil → Synonyme.
  // Ohne Artikel: als Ganzes lassen (z.B. "caro,-a" würde hier landen, tut
  // es aber nicht, weil Fall 1 es vorher abfängt).
  if (trimmed.includes(",")) {
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const allHaveArticles =
      parts.length >= 2 && parts.every(hasArticlePrefix);
    if (allHaveArticles) {
      const stripped = parts.map((p) => stripArticle(p));
      for (const part of parts) variants.add(part);
      for (const s of stripped) variants.add(s);
      variants.add(stripped.join("/"));
      variants.add(stripped.join(", "));
      return Array.from(variants);
    }
  }

  return Array.from(variants);
}

/**
 * Testdokumentation (von Hand nachvollziehbar; KEIN Testrunner):
 *
 *   checkAnswer("caro", "caro,-a")                                 === "correct"
 *   checkAnswer("cara", "caro,-a")                                 === "correct"
 *   checkAnswer("caro,-a", "caro,-a")                              === "correct"
 *   checkAnswer("caro/cara", "caro,-a")                            === "correct"
 *   checkAnswer("el alumno", "el alumno, la alumna")               === "correct"
 *   checkAnswer("alumno", "el alumno, la alumna")                  === "correct"
 *   checkAnswer("der badeanzug", "der Badeanzug / die Badehose")   === "correct"
 *   checkAnswer("badeanzug", "der Badeanzug / die Badehose")       === "correct"
 *   checkAnswer("hund", "der Hund")                                === "correct"
 *   checkAnswer("el nino", "el niño")                              === "almost"
 *   checkAnswer("katze", "der Hund")                               === "wrong"
 *
 *   // Zusatz-Szenarien aus der Praxis:
 *   checkAnswer("guapa", "guapo,-a")                               === "correct"
 *   checkAnswer("alumna", "el alumno, la alumna")                  === "correct"
 *   checkAnswer("contento", "feliz / contento")                    === "correct"
 *   checkAnswer("trabajadora", "trabajador,-a")                    === "correct"
 *
 *   // Nicht abgedeckt (bewusst): "ue" ↔ "ü" Transliteration.
 *   // "Glueck" für "Glück" würde "wrong" zurückgeben. Im Kontext der
 *   // App hat der User eine iOS-Tastatur mit Umlauten und kann "ü" tippen.
 */
export function checkAnswer(
  userInput: string,
  expected: string,
): AnswerResult {
  const userStrict = strictNormalize(userInput);
  const userLoose = normalize(userInput);
  if (!userStrict && !userLoose) return "wrong";

  const userStrictStripped = stripArticle(userStrict);
  const userLooseStripped = stripArticle(userLoose);

  const variants = expandVariants(expected);

  let sawAlmost = false;

  for (const variant of variants) {
    const variantStrict = strictNormalize(variant);
    const variantLoose = normalize(variant);

    if (variantStrict) {
      if (userStrict === variantStrict) return "correct";
      if (userStrictStripped === stripArticle(variantStrict)) return "correct";
    }

    if (variantLoose) {
      if (userLoose === variantLoose) sawAlmost = true;
      else if (userLooseStripped === stripArticle(variantLoose)) {
        sawAlmost = true;
      }
    }
  }

  return sawAlmost ? "almost" : "wrong";
}
