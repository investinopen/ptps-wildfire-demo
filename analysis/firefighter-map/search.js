// geocodes via Photon (komoot's OSM search, open data, no API key) -- used rather than Nominatim, whose usage policy forbids search-as-you-type
const PHOTON_URL = "https://photon.komoot.io/api/";
const MAX_SUGGESTIONS = 6;
// wait for a pause in typing, so there's one request per word rather than per keystroke
const DEBOUNCE_MS = 250;

// "Gold Hill, Boulder, Colorado" -- the place's own name, then where it is, skipping repeats (e.g. a city named after its county)
const placeLabel = ({ name, street, city, county, state }) => {
  const parts = [name || street, city, county, state].filter(Boolean);
  return parts.filter((part, i) => parts.indexOf(part) === i).join(", ");
};

export const bindPlaceSearch = (map) => {
  const form = document.getElementById("place-search");
  const input = document.getElementById("place-search-input");
  const list = document.getElementById("place-search-suggestions");

  let suggestions = [];
  let active = -1;
  let debounceTimer;
  let pending;

  // biased toward what's on screen, so nearby places come first
  const fetchPlaces = async (query) => {
    pending?.abort();
    pending = new AbortController();
    const { lng, lat } = map.getCenter();
    const params = new URLSearchParams({
      q: query,
      // extra, to make up for the duplicates dropped below
      limit: MAX_SUGGESTIONS * 2,
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
      lang: "en",
    });
    const response = await fetch(`${PHOTON_URL}?${params}`, {
      signal: pending.signal,
    });
    const { features } = await response.json();
    // OSM often has the same place as both a point and a boundary, which would otherwise show up twice
    const labels = features.map(({ properties }) => placeLabel(properties));
    return features
      .filter((feature, i) => labels.indexOf(labels[i]) === i)
      .slice(0, MAX_SUGGESTIONS);
  };

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

  const setActive = (index) => {
    active = index;
    [...list.children].forEach((item, i) =>
      item.setAttribute("aria-selected", i === active),
    );
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", list.children[active].id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  };

  const show = (features) => {
    suggestions = features;
    list.replaceChildren(
      ...features.map((feature, i) => {
        const item = document.createElement("li");
        item.id = `place-search-suggestion-${i}`;
        item.setAttribute("role", "option");
        item.textContent = placeLabel(feature.properties);
        // mousedown rather than click, so it lands before the input's blur closes the list
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          choose(i);
        });
        return item;
      }),
    );
    list.hidden = features.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
    setActive(-1);
  };

  const choose = (index) => {
    const feature = suggestions[index];
    input.value = placeLabel(feature.properties);
    close();
    goTo(feature);
  };

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) {
      pending?.abort();
      close();
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        show(await fetchPlaces(query));
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Place search failed:", error);
        }
      }
    }, DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((active + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((active - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      close();
    }
  });

  input.addEventListener("blur", close);

  // Enter: the highlighted suggestion, or else the best match for what's typed
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    if (active >= 0) {
      choose(active);
      return;
    }
    const query = input.value.trim();
    if (!query) return;
    close();
    try {
      const [best] = await fetchPlaces(query);
      if (best) goTo(best);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Place search failed:", error);
      }
    }
  });
};
