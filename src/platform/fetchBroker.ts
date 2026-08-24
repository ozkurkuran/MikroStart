const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface FetchPolicy {
  allowedOrigins: string[];
  acceptedContentTypes: string[];
  maxBytes?: number;
  timeoutMs?: number;
}

export interface BoundedResponse {
  body: string;
  contentType: string;
  etag?: string;
  lastModified?: string;
  finalUrl: string;
}

export async function fetchPublicSource(
  input: string,
  policy: FetchPolicy,
  validators?: { etag?: string; lastModified?: string },
): Promise<BoundedResponse | { notModified: true }> {
  const sourceUrl = new URL(input);
  if (sourceUrl.protocol !== "https:") throw new Error("HTTPS is required.");
  if (!policy.allowedOrigins.includes(sourceUrl.origin)) {
    throw new Error("The source origin is not allowed by this connector.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const headers = new Headers({ Accept: policy.acceptedContentTypes.join(", ") });
  if (validators?.etag) headers.set("If-None-Match", validators.etag);
  if (validators?.lastModified) {
    headers.set("If-Modified-Since", validators.lastModified);
  }

  try {
    const response = await fetch(sourceUrl, {
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
      headers,
    });

    if (response.status === 304) return { notModified: true };
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);

    const finalUrl = new URL(response.url);
    if (!policy.allowedOrigins.includes(finalUrl.origin)) {
      throw new Error("The source redirected to an unapproved origin.");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !policy.acceptedContentTypes.some((accepted) =>
        contentType.toLowerCase().includes(accepted.toLowerCase()),
      )
    ) {
      throw new Error(`Unexpected content type: ${contentType || "unknown"}.`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = policy.maxBytes ?? DEFAULT_MAX_BYTES;
    if (declaredLength > maxBytes) throw new Error("Source response is too large.");

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error("Source response is too large.");

    return {
      body: new TextDecoder().decode(buffer),
      contentType,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
      finalUrl: finalUrl.href,
    };
  } finally {
    clearTimeout(timeout);
  }
}
