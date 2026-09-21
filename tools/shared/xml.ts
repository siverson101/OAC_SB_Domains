// Shared XML text decoding.
//
// Decodes the predefined XML entities plus numeric character references. The
// named entities are decoded after the numeric ones so an escaped ampersand
// (`&amp;lt;`) yields `&lt;`, not `<`.
export function decodeXmlEntities(value: string): string {
  const codePoint = (match: string, digits: string, radix: number): string => {
    const code = Number.parseInt(digits, radix);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  };
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (match, digits: string) => codePoint(match, digits, 16))
    .replace(/&#(\d+);/g, (match, digits: string) => codePoint(match, digits, 10))
    .replace(/&amp;/g, '&');
}
