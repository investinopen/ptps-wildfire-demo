import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { refreshDrpCache } from "./drpClient";
import { getRescue, resolveUrl } from "./resolver";

// Ports tests/test_resolver.py's live-network cases (the pure DRP-matching cases moved to drpClient.test.ts)

beforeAll(async () => {
  // Pre-warm the DRP cache so the "unreachable upstream" test below can stub
  // fetch without also breaking the (already-cached) DRP lookup.
  await refreshDrpCache();
});

describe("resolveUrl", () => {
  it("returns the same URL when there's no redirect", async () => {
    const url = "https://www.ncei.noaa.gov/access/storm-events-database/";
    await expect(resolveUrl(url)).resolves.toBe(url);
  });

  it("follows redirects", async () => {
    const resolved = await resolveUrl("https://www.ncdc.noaa.gov/stormevents/");
    expect(resolved).toBe(
      "https://www.ncei.noaa.gov/access/storm-events-database/",
    );
  });
});

describe("getRescue", () => {
  it("finds a Wayback + DRP match", async () => {
    const rescue = await getRescue(
      "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
    );

    // exact URL can change, so match flexibly
    expect(rescue.waybackNewestUrl).toMatch(
      /^https?:\/\/web\.archive\.org\/web\/\d+\/https:\/\/www\.fema\.gov\/about\/openfema\/data-sets\/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants$/,
    );
    expect(rescue.drpUrl).toBe(
      "https://portal.datarescueproject.org/datasets/non-disaster-and-assistance-to-firefighter-grants/",
    );
  });

  it("finds a DRP partial match", async () => {
    const rescue = await getRescue(
      "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params",
    );

    expect(rescue.drpUrl).toBe(
      "https://portal.datarescueproject.org/datasets/non-disaster-and-assistance-to-firefighter-grants/",
    );
  });

  it("returns nulls when nothing matches", async () => {
    const rescue = await getRescue("http://nota.realdomainname");
    expect(rescue.waybackNewestUrl).toBeNull();
    expect(rescue.drpUrl).toBeNull();
  });

  it("returns nulls when upstream servers are unreachable", async () => {
    // Imagining that the resolver isn't able to reach the upstream servers sometimes
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const rescue = await getRescue("https://investinopen.org/");
    expect(rescue.waybackNewestUrl).toBeNull();
    expect(rescue.drpUrl).toBeNull();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
