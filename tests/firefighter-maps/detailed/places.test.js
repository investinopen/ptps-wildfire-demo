import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  placeHeading,
  stateAt,
  US_STATES_URL,
} from "../../../site/firefighter-maps/detailed/scripts/places.js";

const view = { width: 400, height: 300 };
const place = (name, cls, x, y, rank = 10) => ({
  name,
  class: cls,
  rank,
  x,
  y,
});

// most tests leave the state out, to focus on which places are named
const noState = () => undefined;

describe("placeHeading", () => {
  test("names the place in view", () => {
    expect(
      placeHeading([place("Salina", "hamlet", 200, 150)], view, noState),
    ).toBe("Salina");
  });

  test("lists places in view most important first, up to three", () => {
    const places = [
      place("Sunshine", "hamlet", 50, 50),
      place("Boulder", "city", 300, 200),
      place("Gold Hill", "village", 100, 250),
      place("Salina", "hamlet", 200, 150, 5),
    ];
    expect(placeHeading(places, view, noState)).toBe(
      "Boulder, Gold Hill, Salina",
    );
  });

  test("falls back to the nearest place when none are in view", () => {
    const places = [
      place("Jamestown", "village", -900, 150),
      place("Gold Hill", "village", -100, 150),
    ];
    expect(placeHeading(places, view, noState)).toBe("Near Gold Hill");
  });

  test("ignores neighborhoods and unnamed places", () => {
    const places = [
      place("Whittier", "neighbourhood", 200, 150),
      place(undefined, "hamlet", 210, 150),
      place("Boulder", "city", 900, 150),
    ];
    expect(placeHeading(places, view, noState)).toBe("Near Boulder");
  });

  // a place near a tile edge can come back from more than one tile
  test("lists each place once", () => {
    const places = [
      place("Salina", "hamlet", 200, 150),
      place("Salina", "hamlet", 200, 150),
    ];
    expect(placeHeading(places, view, noState)).toBe("Salina");
  });

  test("follows the places with their state", () => {
    const places = [
      place("Gold Hill", "village", 100, 250),
      place("Salina", "hamlet", 200, 150),
    ];
    expect(placeHeading(places, view, () => "Colorado")).toBe(
      "Gold Hill, Salina, Colorado",
    );
  });

  test("gives each place its own state when they're in different ones", () => {
    const places = [
      place("Fort Collins", "city", 100, 250),
      place("Cheyenne", "city", 200, 150, 5),
    ];
    const states = { "Fort Collins": "Colorado", Cheyenne: "Wyoming" };
    expect(placeHeading(places, view, (p) => states[p.name])).toBe(
      "Cheyenne, Wyoming; Fort Collins, Colorado",
    );
  });

  test("includes the state of the nearest place", () => {
    const places = [place("Gold Hill", "village", -100, 150)];
    expect(placeHeading(places, view, () => "Colorado")).toBe(
      "Near Gold Hill, Colorado",
    );
  });

  test("is empty with no places at all", () => {
    expect(placeHeading([], view, noState)).toBe("");
  });
});

describe("stateAt", () => {
  const states = JSON.parse(readFileSync(US_STATES_URL, "utf8"));

  test("finds the state a point is in", () => {
    expect(stateAt(states, [-105.375925, 40.052187])).toBe("Colorado"); // Gold Hill
    expect(stateAt(states, [-104.8202, 41.14])).toBe("Wyoming"); // Cheyenne
  });

  // Hawaii and Alaska are multipolygons, unlike most states
  test("handles states made of several polygons", () => {
    expect(stateAt(states, [-155.09, 19.72])).toBe("Hawaii"); // Hilo
  });

  test("is undefined outside the US", () => {
    expect(stateAt(states, [-123.1207, 49.2827])).toBeUndefined(); // Vancouver, BC
    expect(stateAt(states, [-40, 30])).toBeUndefined(); // mid-Atlantic
  });
});
