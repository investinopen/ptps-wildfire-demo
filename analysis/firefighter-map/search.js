// geocodes via Nominatim (OSM's own search, open data, no API key)
export const bindPlaceSearch = (map) => {
  document
    .getElementById("place-search")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const query = document.getElementById("place-search-input").value.trim();
      if (!query) return;
      try {
        const response = await fetch(
          "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
            encodeURIComponent(query),
        );
        const results = await response.json();
        if (results.length === 0) return;
        const { lon, lat, boundingbox } = results[0];
        if (boundingbox) {
          const [south, north, west, east] = boundingbox.map(Number);
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 40, maxZoom: 17 },
          );
        } else {
          map.flyTo({ center: [Number(lon), Number(lat)], zoom: 16 });
        }
      } catch (error) {
        console.error("Place search failed:", error);
      }
    });
};
