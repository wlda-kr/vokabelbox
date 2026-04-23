const PUNCTUATION_RE = /[.,;!?¡¿]/g;
const WHITESPACE_RE = /\s+/g;
const HYPHEN_WHITESPACE_RE = /[-\s]+/g;
const DIACRITICS_RE = /[\u0300-\u036f]/g;
const LEADING_ARTICLE_RE =
  /^(el|la|los|las|un|una|der|die|das|ein|eine)\s+/i;

export type AnswerResult = "correct" | "almost" | "wrong";

// Streng: lowercase + trim + punctuation. Behält Diakritika und Bindestriche.
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

export function checkAnswer(
  userInput: string,
  expected: string,
): AnswerResult {
  const userStrict = strictNormalize(userInput);
  const userLoose = normalize(userInput);
  if (!userStrict && !userLoose) return "wrong";

  const alts = expected
    .split(/[/,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  let sawAlmost = false;

  for (const alt of alts) {
    const altStrict = strictNormalize(alt);
    const altLoose = normalize(alt);

    if (altStrict) {
      if (userStrict === altStrict) return "correct";
      if (stripArticle(userStrict) === stripArticle(altStrict)) return "correct";
    }

    if (altLoose) {
      if (userLoose === altLoose) sawAlmost = true;
      else if (stripArticle(userLoose) === stripArticle(altLoose)) sawAlmost = true;
    }
  }

  return sawAlmost ? "almost" : "wrong";
}
