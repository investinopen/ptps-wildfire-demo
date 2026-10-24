import { bindCombobox } from "./combobox.js";

// geocodes via Photon (komoot's OSM search, open data, no API key) -- used rather than Nominatim, whose usage policy forbids search-as-you-type
const PHOTON_URL = "https://photon.komoot.io/api/";
const MAX_SUGGESTIONS = 6;

// "Gold Hill, Boulder, Colorado" -- the place's own name, then where it is, skipping repeats (e.g. a city named after its county)
const placeLabel = ({ name, street, city, county, state }) => {
  const parts = [name || street, city, county, state].filter(Boolean);
  return parts.filter((part, i) => parts.indexOf(part) === i).join(", ");
};

// Photon's matches for the query, biased toward what's on screen so nearby places come first
const fetchPlaces = async (map, query, signal) => {
  const { lng, lat } = map.getCenter();
  const search = new URLSearchParams({
    // only places the map can show
    bbox: map.getMaxBounds().toArray().flat().join(","),
    q: query,
    // extra, to make up for the duplicates dropped below
    limit: MAX_SUGGESTIONS * 2,
    lat: lat.toFixed(4),
    lon: lng.toFixed(4),
    lang: "en",
  });
  const response = await fetch(`${PHOTON_URL}?${search}`, { signal });
  const { features } = await response.json();
  // OSM often has the same place as both a point and a boundary, which would otherwise show up twice
  const labels = features.map(({ properties }) => placeLabel(properties));
  return features
    .filter((feature, i) => labels.indexOf(labels[i]) === i)
    .slice(0, MAX_SUGGESTIONS);
};

export const bindPlaceSearch = (map) => {
  const goTo = ({ geometry, properties }) => {
    if (properties.extent) {
      // Photon's extent is [west, north, east, south]
      const [west, north, east, south] = properties.extent;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 40, maxZoom: 17 },
      );
    } else {
      map.flyTo({ center: geometry.coordinates, zoom: 16 });
    }
  };

  bindCombobox({
    form: document.getElementById("place-search"),
    input: document.getElementById("place-search-input"),
    list: document.getElementById("place-search-suggestions"),
    search: (query, signal) => fetchPlaces(map, query, signal),
    label: ({ properties }) => placeLabel(properties),
    onChoose: goTo,
  });
};
