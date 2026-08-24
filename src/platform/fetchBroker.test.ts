import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPublicSource } from "./fetchBroker";

const policy = {
  allowedOrigins: ["https://example.org"],
  acceptedContentTypes: ["application/rss+xml", "application/xml"],
  maxBytes: 128,
};

function responseAt(url: string, body: string, init: ResponseInit): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPublicSource", () => {
  it("returns a bounded public response without credentials", async () => {
    const fetchMock = vi.fn(async (_input: URL, init?: RequestInit) =>
      responseAt("https://example.org/feed.xml", "<rss />", {
        status: 200,
        headers: { "content-type": "application/rss+xml", etag: "v1" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPublicSource("https://example.org/feed.xml", policy);

    expect(result).toMatchObject({
      body: "<rss />",
      contentType: "application/rss+xml",
      etag: "v1",
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "omit" });
  });

  it("rejects HTTP and undeclared origins before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicSource("http://example.org/feed", policy)).rejects.toThrow(
      "HTTPS is required",
    );
    await expect(fetchPublicSource("https://other.example/feed", policy)).rejects.toThrow(
      "not allowed",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects redirects to an unapproved origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responseAt("https://tracking.example/feed.xml", "<rss />", {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        }),
      ),
    );

    await expect(
      fetchPublicSource("https://example.org/feed.xml", policy),
    ).rejects.toThrow("redirected to an unapproved origin");
  });

  it("rejects unexpected content and oversized bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responseAt("https://example.org/feed.xml", "not xml", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    await expect(
      fetchPublicSource("https://example.org/feed.xml", policy),
    ).rejects.toThrow("Unexpected content type");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responseAt("https://example.org/feed.xml", "x".repeat(129), {
          status: 200,
          headers: { "content-type": "application/xml" },
        }),
      ),
    );
    await expect(
      fetchPublicSource("https://example.org/feed.xml", policy),
    ).rejects.toThrow("too large");
  });
});
