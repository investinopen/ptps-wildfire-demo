// The heading at the top of the sidebar, naming the town(s) the map is showing -- from the place points in the map's own tiles, so it needs no extra requests and works offline. Useful on a printout especially, where there's no search box or URL to say where it is.

// kinds of places worth naming, most important first -- not neighborhoods/suburbs, which would crowd out the town itself
// https://openmaptiles.org/schema/#place
const PLACE_CLASSES = ["city", "town", "village", "hamlet"];
// most places to list when several are in view
const MAX_PLACES = 3;

// Given places as { name, class, rank, x, y } (x/y in screen pixels) and the viewport's { width, height }, returns the heading: the most important places in view, or the nearest one as "Near …" if none are -- or "" if there are none at all.
export const placeHeading = (places, { width, height }) => {
  const importance = (p) => [PLACE_CLASSES.indexOf(p.class), p.rank ?? 0];
  const byImportance = (a, b) => {
    const [ca, ra] = importance(a);
    const [cb, rb] = importance(b);
    return ca - cb || ra - rb;
  };
  const named = places.filter((p) => p.name && PLACE_CLASSES.includes(p.class));
  const inView = named.filter(
    (p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height,
  );
  if (inView.length) {
    const names = [...new Set(inView.sort(byImportance).map((p) => p.name))];
    return names.slice(0, MAX_PLACES).join(", ");
  }
  const center = { x: width / 2, y: height / 2 };
  const distance = (p) => Math.hypot(p.x - center.x, p.y - center.y);
  const nearest = named.sort((a, b) => distance(a) - distance(b))[0];
  return nearest ? `Near ${nearest.name}` : "";
};

// keeps the sidebar heading up to date as the map moves. Only looks at the tiles the map has loaded (roughly what's on screen), so zoomed in on a remote road with no place nearby, the heading is just left off.
export const bindPlaceHeading = (map) => {
  const heading = document.getElementById("map-places");
  const update = () => {
    const places = map
      .querySourceFeatures("roadsSource", { sourceLayer: "place" })
      .filter(({ geometry }) => geometry.type === "Point")
      .map(({ properties, geometry }) => ({
        name: properties.name,
        class: properties.class,
        rank: properties.rank,
        ...map.project(geometry.coordinates),
      }));
    const canvas = map.getCanvas();
    const text = placeHeading(places, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });
    heading.textContent = text;
    heading.hidden = !text;
  };
  map.on("idle", update);
};
