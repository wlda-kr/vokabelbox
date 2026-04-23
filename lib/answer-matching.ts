const PUNCTUATION_RE = /[.,;!?¡¿]/g;
const WHITESPACE_RE = /\s+/g;
const LEADING_ARTICLE_RE =
  /^(el|la|los|las|un|una|der|die|das|ein|eine)\s+/i;

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(PUNCTUATION_RE, "")
    .replace(WHITESPACE_RE, " ")
    .trim();
}

export function stripArticle(input: string): string {
  return input.replace(LEADING_ARTICLE_RE, "");
}

export function isAnswerCorrect(userInput: string, expected: string): boolean {
  const user = normalize(userInput);
  if (!user) return false;

  const alternatives = expected
    .split(/[/,]/)
    .map((part) => normalize(part))
    .filter(Boolean);

  const userStripped = stripArticle(user);

  for (const alt of alternatives) {
    if (user === alt) return true;
    if (userStripped === stripArticle(alt)) return true;
  }

  return false;
}
