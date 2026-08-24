const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref_src",
]);

const DEFAULT_TEXT_LIMIT = 4_000;

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(?:#(\d{1,7})|#x([\da-f]{1,6})|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal || hexadecimal) {
        const codePoint = Number.parseInt(decimal ?? hexadecimal!, decimal ? 10 : 16);
        if (
          !Number.isFinite(codePoint) ||
          codePoint <= 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return " ";
        }

        return String.fromCodePoint(codePoint);
      }

      switch (entity.toLowerCase()) {
        case "&amp;":
          return "&";
        case "&apos;":
          return "'";
        case "&gt;":
          return ">";
        case "&lt;":
          return "<";
        case "&nbsp;":
          return " ";
        case "&quot;":
          return '"';
        default:
          return " ";
      }
    },
  );
}

/** Converts untrusted feed markup into bounded text suitable for textContent. */
export function toPlainText(value: unknown, maxLength = DEFAULT_TEXT_LIMIT): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  const boundedLength = Math.max(0, Math.min(Math.trunc(maxLength), 20_000));
  if (boundedLength === 0) return "";

  const decoded = decodeHtmlEntities(String(value));
  const withoutActiveBlocks = decoded
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  return withoutActiveBlocks
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, boundedLength);
}

/**
 * Returns a canonical HTTPS URL or undefined. Credentials and unsafe schemes are
 * rejected; common tracking parameters and fragments are removed.
 */
export function canonicalizeHttpsUrl(value: unknown, baseUrl?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = decodeHtmlEntities(value).trim();
  if (!candidate || candidate.length > 4_096) return undefined;

  try {
    const url = baseUrl ? new URL(candidate, baseUrl) : new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;

    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    const sorted = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    );
    url.search = "";
    for (const [key, item] of sorted) url.searchParams.append(key, item);

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

export function normalizeIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const timestamp = Date.parse(String(value).trim());
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function normalizeLanguage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const language = value.trim().replace(/_/g, "-");
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)
    ? language.toLowerCase()
    : undefined;
}
