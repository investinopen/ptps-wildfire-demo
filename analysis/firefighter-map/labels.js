// Fallback labels for named roads that MapLibre couldn't label along the line -- ones shorter than their own name (cul-de-sacs, short connectors) or too curvy. Each gets a horizontal label at the middle of its longest stretch on screen instead, so every named road in view has a readable name. Only roads MapLibre skipped get one, so there are no duplicates.

// how much of a road has to be on screen (in pixels) for it to count as "in view", so a road just clipping the edge doesn't get a label
const MIN_VISIBLE_PX = 30;

const segmentLength = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const inRect = ({ x, y }, rect) =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height;

// How far a fallback label's anchor has to stay from the map's edges and anything covering it. The label is centered on its anchor vertically, so it needs about half its height above/below; horizontally it can shift to either side of its anchor to fit (see ROAD_LABEL_FALLBACKS_LAYER's text-variable-anchor), so only a little room is needed.
const ANCHOR_MARGIN = { x: 4, y: 10 };

const grow = (rect, { x, y }) => ({
  x: rect.x - x,
  y: rect.y - y,
  width: rect.width + 2 * x,
  height: rect.height + 2 * y,
});

// on screen, and not under (or right up against) anything covering the map (the legend, controls, etc.)
const isVisible = (point, { width, height, obstructions = [] }) =>
  inRect(
    point,
    grow(
      { x: 0, y: 0, width, height },
      { x: -ANCHOR_MARGIN.x, y: -ANCHOR_MARGIN.y },
    ),
  ) && !obstructions.some((rect) => inRect(point, grow(rect, ANCHOR_MARGIN)));

// the point halfway along a run of points
const midpoint = (points) => {
  const total = points
    .slice(1)
    .reduce((sum, p, i) => sum + segmentLength(points[i], p), 0);
  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    const length = segmentLength(points[i - 1], points[i]);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    remaining -= length;
  }
  return points.at(-1);
};

// the longest stretch of consecutive visible points in any of the lines, with its length
const longestVisibleRun = (lines, viewport) => {
  let best = { points: [], length: 0 };
  for (const line of lines) {
    let run = [];
    let length = 0;
    const finish = () => {
      if (length > best.length) best = { points: run, length };
      run = [];
      length = 0;
    };
    for (const point of line) {
      if (!isVisible(point, viewport)) {
        finish();
        continue;
      }
      if (run.length) length += segmentLength(run.at(-1), point);
      run.push(point);
    }
    finish();
  }
  return best;
};

// Given named roads as { name, lines } (each line an array of { x, y } screen points), the names that already have a label on screen, and the viewport as { width, height, obstructions } (obstructions being { x, y, width, height } rects covering the map), returns { name, x, y } for where each unlabeled road's fallback label should go.
export const unlabeledRoadAnchors = (roads, labeledNames, viewport) => {
  const byName = new Map();
  for (const { name, lines } of roads) {
    if (!name || labeledNames.has(name)) continue;
    byName.set(name, [...(byName.get(name) ?? []), ...lines]);
  }
  const anchors = [];
  for (const [name, lines] of byName) {
    const { points, length } = longestVisibleRun(lines, viewport);
    if (length >= MIN_VISIBLE_PX) anchors.push({ name, ...midpoint(points) });
  }
  return anchors;
};

// keeps the fallback labels' source up to date as the map moves
export const bindFallbackRoadLabels = (
  map,
  { sourceId, labelLayerId, roadsFilter },
) => {
  let previous = "";
  const update = () => {
    if (map.getLayoutProperty(labelLayerId, "visibility") === "none") return;
    const toScreen = (coordinates) => coordinates.map((c) => map.project(c));
    const roads = map
      .querySourceFeatures("roadsSource", {
        sourceLayer: "transportation_name",
        filter: roadsFilter,
      })
      // the layer has a few points too (e.g. junctions), which have no length to label along
      .filter(({ geometry }) =>
        ["LineString", "MultiLineString"].includes(geometry.type),
      )
      .map(({ properties, geometry }) => ({
        name: properties.name,
        lines:
          geometry.type === "MultiLineString"
            ? geometry.coordinates.map(toScreen)
            : [toScreen(geometry.coordinates)],
      }));
    const labeled = new Set(
      map
        .queryRenderedFeatures({ layers: [labelLayerId] })
        .map((f) => f.properties.name),
    );
    const canvas = map.getCanvas();
    const anchors = unlabeledRoadAnchors(roads, labeled, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      obstructions: coveredRects(map, overlayElements(map)),
    });
    // setting the data re-renders the map, which fires "idle" again -- only set it when it's changed, or this would loop
    const key = anchors
      .map((a) => `${a.name}@${Math.round(a.x)},${Math.round(a.y)}`)
      .join("|");
    if (key === previous) return;
    previous = key;
    map.getSource(sourceId).setData({
      type: "FeatureCollection",
      features: anchors.map(({ name, x, y }) => {
        const { lng, lat } = map.unproject([x, y]);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: { name },
        };
      }),
    });
  };
  map.on("idle", update);
};

// The parts of the map's canvas covered by something else, as { x, y, width, height } rects relative to the canvas.
const coveredRects = (map, elements) => {
  const canvas = map.getCanvas().getBoundingClientRect();
  return elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: rect.left - canvas.left,
      y: rect.top - canvas.top,
      width: rect.width,
      height: rect.height,
    }));
};

// the elements over the map that labels shouldn't go under
const overlayElements = (map) =>
  [
    document.getElementById("top-left-controls"),
    ...map
      .getContainer()
      .querySelectorAll(
        ".maplibregl-ctrl-top-right .maplibregl-ctrl, .maplibregl-ctrl-bottom-left .maplibregl-ctrl, .maplibregl-ctrl-bottom-right .maplibregl-ctrl",
      ),
  ].filter(Boolean);

// MapLibre has no way to keep labels out of part of the map, and places them under the legend/controls or running off the edge, where they can't be read. So this puts invisible boxes over those spots as symbols of their own, placed ahead of every label (see LABEL_BLOCKERS_LAYER) -- they don't show, but other labels avoid them like they would any other label. Updated whenever what's on screen could have changed.
export const bindLabelBlockers = (map, { sourceId }) => {
  // how far past each edge the edge blockers reach, so a label crossing the edge always hits one
  const EDGE = 4;
  let imageCount = 0;
  const update = () => {
    const canvas = map.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const rects = [
      ...coveredRects(map, overlayElements(map)),
      { x: -EDGE, y: -EDGE, width: width + 2 * EDGE, height: EDGE * 2 },
      { x: -EDGE, y: height - EDGE, width: width + 2 * EDGE, height: EDGE * 2 },
      { x: -EDGE, y: -EDGE, width: EDGE * 2, height: height + 2 * EDGE },
      { x: width - EDGE, y: -EDGE, width: EDGE * 2, height: height + 2 * EDGE },
    ];
    // one transparent image per box, at its exact size -- only its size matters for collisions
    rects.forEach((rect, i) => {
      const name = `label-blocker-${i}`;
      const image = new ImageData(
        Math.max(1, Math.round(rect.width)),
        Math.max(1, Math.round(rect.height)),
      );
      if (map.hasImage(name)) map.removeImage(name);
      map.addImage(name, image);
    });
    for (let i = rects.length; i < imageCount; i++) {
      map.removeImage(`label-blocker-${i}`);
    }
    imageCount = rects.length;
    map.getSource(sourceId).setData({
      type: "FeatureCollection",
      features: rects.map((rect, i) => {
        const { lng, lat } = map.unproject([
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ]);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: { image: `label-blocker-${i}` },
        };
      }),
    });
  };
  map.on("load", update);
  map.on("moveend", update);
  map.on("resize", update);
  // e.g. the legend's keys showing/hiding with their layers
  new ResizeObserver(() => map.loaded() && update()).observe(
    document.getElementById("top-left-controls"),
  );
};
