export interface FrenchStationIdentity {
  name: string | null;
  brand: string | null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const decodeHtmlText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();

const textOrNull = (html: string | undefined): string | null => {
  const text = html === undefined ? '' : decodeHtmlText(html);
  return text === '' ? null : text;
};

/**
 * Name and brand from the station fragment of prix-carburants.gouv.fr: the name is the `<h3>`,
 * the brand the first `<strong>` after it. Missing parts become `null`.
 */
export const parseFrenchStationIdentity = (html: string): FrenchStationIdentity => {
  const nameMatch = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(html);
  const afterName = nameMatch === null ? html : html.slice(nameMatch.index + nameMatch[0].length);
  const brandMatch = /<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(afterName);
  return { name: textOrNull(nameMatch?.[1]), brand: textOrNull(brandMatch?.[1]) };
};
