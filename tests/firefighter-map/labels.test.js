import { describe, expect, test } from "vitest";
import { unlabeledRoadAnchors } from "../../analysis/firefighter-map/labels.js";

const viewport = { width: 400, height: 300 };
// a straight road across the middle of the view
const line = (x1, y1, x2, y2) => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

describe("unlabeledRoadAnchors", () => {
  test("anchors an unlabeled road at the middle of its visible stretch", () => {
    const roads = [
      { name: "Appletree Court", lines: [line(100, 150, 200, 150)] },
    ];
    expect(unlabeledRoadAnchors(roads, new Set(), viewport)).toEqual([
      { name: "Appletree Court", x: 150, y: 150 },
    ]);
  });

  test("skips roads that already have a label", () => {
    const roads = [{ name: "Broadway", lines: [line(100, 150, 200, 150)] }];
    expect(
      unlabeledRoadAnchors(roads, new Set(["Broadway"]), viewport),
    ).toEqual([]);
  });

  test("skips unnamed roads", () => {
    const roads = [{ name: undefined, lines: [line(100, 150, 200, 150)] }];
    expect(unlabeledRoadAnchors(roads, new Set(), viewport)).toEqual([]);
  });

  // e.g. Fred Road, with just a few pixels at the bottom of the view
  test("skips roads that barely reach into the view", () => {
    const roads = [{ name: "Fred Road", lines: [line(100, 295, 100, 500)] }];
    expect(unlabeledRoadAnchors(roads, new Set(), viewport)).toEqual([]);
  });

  test("only uses the part of the road that's on screen", () => {
    // runs from well off the left edge to x=200; the on-screen part starts at the first point inside
    const roads = [
      {
        name: "Long Road",
        lines: [
          [
            { x: -500, y: 150 },
            { x: 100, y: 150 },
            { x: 200, y: 150 },
          ],
        ],
      },
    ];
    expect(unlabeledRoadAnchors(roads, new Set(), viewport)).toEqual([
      { name: "Long Road", x: 150, y: 150 },
    ]);
  });

  test("doesn't anchor under something covering the map, like the legend", () => {
    const legend = { x: 0, y: 0, width: 160, height: 300 };
    const roads = [
      { name: "Hidden Road", lines: [line(20, 150, 140, 150)] },
      {
        name: "Half Hidden",
        lines: [
          [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 300, y: 100 },
          ],
        ],
      },
    ];
    expect(
      unlabeledRoadAnchors(roads, new Set(), {
        ...viewport,
        obstructions: [legend],
      }),
    ).toEqual([{ name: "Half Hidden", x: 250, y: 100 }]);
  });

  test("combines a road's pieces, using the longest", () => {
    const roads = [
      { name: "Split Street", lines: [line(10, 50, 50, 50)] },
      { name: "Split Street", lines: [line(100, 200, 300, 200)] },
    ];
    expect(unlabeledRoadAnchors(roads, new Set(), viewport)).toEqual([
      { name: "Split Street", x: 200, y: 200 },
    ]);
  });

  test("follows bends when finding the middle", () => {
    // an L: 100px right, then 100px down, so the middle is at the corner
    const roads = [
      {
        name: "Corner Court",
        lines: [
          [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
          ],
        ],
      },
    ];
    expect(unlabeledRoadAnchors(roads, new Set(), viewport)).toEqual([
      { name: "Corner Court", x: 200, y: 100 },
    ]);
  });
});
