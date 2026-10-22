export interface FrenchStationIdentity {
  name: string | null;
  brand: string | null;
}

const NAMED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['nbsp', ' '],
  ['quot', '"'],
]);

const MAXIMUM_CODE_POINT = 0x10ffff;
const FIRST_SURROGATE = 0xd800;
const LAST_SURROGATE = 0xdfff;

const ASCII_WHITESPACE_CODE_POINTS: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0c, 0x0d]);

/** C0 controls, DELETE and C1 controls, as the HTML specification defines them. */
const isControlCharacter = (codePoint: number): boolean =>
  (codePoint < 0x20 && !ASCII_WHITESPACE_CODE_POINTS.has(codePoint)) ||
  (codePoint >= 0x7f && codePoint <= 0x9f);

const isValidCodePoint = (codePoint: number): boolean =>
  codePoint <= MAXIMUM_CODE_POINT &&
  (codePoint < FIRST_SURROGATE || codePoint > LAST_SURROGATE) &&
  !isControlCharacter(codePoint);

// String.fromCodePoint throws for out-of-range values, which would fail the whole search, and
// control characters have no place in a station name.
const characterOrEntity = (codePoint: number, entity: string): string =>
  isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;

const decodeHtmlText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        return characterOrEntity(Number.parseInt(code.slice(2), 16), entity);
      }
      if (code.startsWith('#')) {
        return characterOrEntity(Number.parseInt(code.slice(1), 10), entity);
      }
      return NAMED_ENTITIES.get(code.toLowerCase()) ?? entity;
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
