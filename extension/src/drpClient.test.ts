import { describe, expect, it } from "vitest";
import { getDrpMatch } from "./drpClient";
import type { DrpRow } from "./types";

// Ports tests/test_resolver.py::test_get_drp_match_prefers_longest_common_prefix / _no_common_prefix

describe("getDrpMatch", () => {
  it("prefers the longest common prefix", () => {
    const rows: DrpRow[] = [
      { data_source: "https://example.com/", url: "/" },
      { data_source: "https://example.com/datasets/", url: "/datasets/" },
      {
        data_source: "https://example.com/datasets/forest",
        url: "/datasets/other/",
      },
      {
        data_source: "https://example.com/datasets/forest-floods",
        url: "/datasets/specific/",
      },
    ];

    const match = getDrpMatch(
      rows,
      "https://example.com/datasets/forest-floods?year=2026",
    );

    expect(match?.url).toBe("/datasets/specific/");
  });

  it("falls back to the best match when there's no full-prefix match", () => {
    const rows: DrpRow[] = [
      { data_source: "https://example.com/", url: "/" },
      { data_source: "https://example.com/datasets/", url: "/datasets/" },
      {
        data_source: "https://example.com/datasets/forest-cover",
        url: "/datasets/other/",
      },
    ];

    const match = getDrpMatch(
      rows,
      "https://example.com/datasets/forest-floods?year=2026",
    );

    expect(match?.url).toBe("/datasets/");
  });

  it("prefers an exact match over a partial one", () => {
    const rows: DrpRow[] = [
      {
        data_source: "https://example.com/datasets/forest",
        url: "/datasets/partial/",
      },
      {
        data_source: "https://example.com/datasets/forest-floods",
        url: "/datasets/exact/",
      },
    ];

    const match = getDrpMatch(
      rows,
      "https://example.com/datasets/forest-floods",
    );

    expect(match?.url).toBe("/datasets/exact/");
  });

  it("returns null when nothing matches", () => {
    const rows: DrpRow[] = [{ data_source: "https://example.com/", url: "/" }];

    const match = getDrpMatch(rows, "http://nota.realdomainname");

    expect(match).toBeNull();
  });
});
