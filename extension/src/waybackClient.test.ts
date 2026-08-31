import { afterEach, describe, expect, it, vi } from "vitest";
import { getWaybackMatch, saveToWayback } from "./waybackClient";

// Ports tests/test_internet_archive_client.py

describe("getWaybackMatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the Internet Archive responds with a server error", async () => {
    // Imagining that the resolver isn't able to reach the upstream servers sometimes
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 500 })),
    );

    const match = await getWaybackMatch("https://investinopen.org/");
    expect(match).toBeNull();
  });

  it("returns null when the request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted", "AbortError");
      }),
    );

    const match = await getWaybackMatch("https://investinopen.org/");
    expect(match).toBeNull();
  });
});

describe("saveToWayback", () => {
  it("saves a live URL to the Wayback Machine", async () => {
    // 429 is expected here sometimes: unlike the Python client, this has no
    // auth-key support, so anonymous requests are more likely to be rate-limited.
    const response = await saveToWayback("https://investinopen.org/");
    expect([200, 429]).toContain(response?.status);
  });
});
