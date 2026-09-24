import { describe, expect, test } from "vitest";
import { placeHeading } from "../../site/firefighter-map/scripts/places.js";

const view = { width: 400, height: 300 };
const place = (name, cls, x, y, rank = 10) => ({
  name,
  class: cls,
  rank,
  x,
  y,
});

describe("placeHeading", () => {
  test("names the place in view", () => {
    expect(placeHeading([place("Salina", "hamlet", 200, 150)], view)).toBe(
      "Salina",
    );
  });

  test("lists places in view most important first, up to three", () => {
    const places = [
      place("Sunshine", "hamlet", 50, 50),
      place("Boulder", "city", 300, 200),
      place("Gold Hill", "village", 100, 250),
      place("Salina", "hamlet", 200, 150, 5),
    ];
    expect(placeHeading(places, view)).toBe("Boulder, Gold Hill, Salina");
  });

  test("falls back to the nearest place when none are in view", () => {
    const places = [
      place("Jamestown", "village", -900, 150),
      place("Gold Hill", "village", -100, 150),
    ];
    expect(placeHeading(places, view)).toBe("Near Gold Hill");
  });

  test("ignores neighborhoods and unnamed places", () => {
    const places = [
      place("Whittier", "neighbourhood", 200, 150),
      place(undefined, "hamlet", 210, 150),
      place("Boulder", "city", 900, 150),
    ];
    expect(placeHeading(places, view)).toBe("Near Boulder");
  });

  // a place near a tile edge can come back from more than one tile
  test("lists each place once", () => {
    const places = [
      place("Salina", "hamlet", 200, 150),
      place("Salina", "hamlet", 200, 150),
    ];
    expect(placeHeading(places, view)).toBe("Salina");
  });

  test("is empty with no places at all", () => {
    expect(placeHeading([], view)).toBe("");
  });
});
