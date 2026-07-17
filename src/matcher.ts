/**
 * Reference detection — the ONLY strings this loader ever touches are DIG
 * references: a `urn:dig:chia:…` URN or a `chia://…` URL. Everything else in the
 * DOM is left exactly as the page authored it.
 */

// A single DIG reference token. The character class is the RFC 3986 URI set plus
// `:` (URN segment separators) — it stops at whitespace, quotes, commas, and the
// `)` that closes a CSS `url(...)`, so a token extracted from srcset / CSS is exact.
const REF_TOKEN = /(?:urn:dig:chia:|chia:\/\/)[A-Za-z0-9\-._~:/?#[\]@!$&'*+;=%]+/gi;

/** True iff the value contains at least one DIG reference. Cheap membership test. */
export function containsDigRef(value: string | null | undefined): boolean {
  if (!value) return false;
  REF_TOKEN.lastIndex = 0;
  return REF_TOKEN.test(value);
}

/**
 * Replace every DIG-reference token in `value` using `replace`, leaving all
 * non-DIG text (descriptors, other URLs, surrounding CSS) byte-identical. This is
 * a pure token substitution — the string is NEVER reparsed into markup.
 */
export async function replaceDigRefs(
  value: string,
  replace: (ref: string) => Promise<string>,
): Promise<string> {
  const tokens = value.match(REF_TOKEN);
  if (!tokens) return value;

  // Resolve the distinct tokens once, then substitute — a value may repeat a ref.
  const unique = [...new Set(tokens)];
  const resolved = new Map<string, string>();
  await Promise.all(
    unique.map(async (ref) => {
      resolved.set(ref, await replace(ref));
    }),
  );

  return value.replace(REF_TOKEN, (ref) => resolved.get(ref) ?? ref);
}

/**
 * Extract the DIG `url(...)` targets from a CSS text fragment (a `style` attribute,
 * a `<style>` element's text, or an inline `background-image`). Returns the exact
 * inner reference of each `url()` whose target is a DIG reference.
 */
const CSS_URL = /url\(\s*(['"]?)((?:urn:dig:chia:|chia:\/\/)[^'")]+)\1\s*\)/gi;

/** Replace every DIG `url(...)` in a CSS fragment via `replace`, leaving the rest. */
export async function replaceCssUrls(
  css: string,
  replace: (ref: string) => Promise<string>,
): Promise<string> {
  const refs = [...css.matchAll(CSS_URL)].map((m) => m[2]!);
  if (refs.length === 0) return css;

  const resolved = new Map<string, string>();
  await Promise.all(
    [...new Set(refs)].map(async (ref) => {
      resolved.set(ref, await replace(ref));
    }),
  );

  return css.replace(CSS_URL, (whole, quote: string, ref: string) =>
    resolved.has(ref) ? `url(${quote}${resolved.get(ref)}${quote})` : whole,
  );
}
