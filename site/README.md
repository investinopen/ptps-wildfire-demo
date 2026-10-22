# GitHub Pages site

A [homepage](index.qmd) introducing the project, the [fallback tools](fallbacks.qmd), the [dataset rescue status report](analysis/rescue-status.qmd), the [risk](analysis/risk.ipynb) and [wildfire overlap](analysis/fire_overlap.ipynb) notebooks, and the [detailed](#detailed) and [simplified](#simplified) [firefighter maps](#firefighter-maps) are published together as a [Quarto](https://quarto.org/) website, configured in [`_quarto.yml`](_quarto.yml). The rescue status report and the two notebooks live in [`analysis/`](analysis/#readme), along with the notebooks that aren't pages. The pages that run against live data (the rescue status report, the two notebooks, and the simplified firefighter map) are [re-executed daily](../.github/workflows/refresh-notebooks.yml) and whenever their code changes, so their live layers stay current. The site is [published](../.github/workflows/publish-site.yml) after each of those refreshes and whenever it changes, using the latest refreshed results rather than executing anything itself -- so if a data source is down, the pages just stay as of the last refresh. To preview locally, [install Quarto](https://quarto.org/docs/get-started/), then from the repository root run:

```sh
uv run quarto preview site
```

## Firefighter maps

Both in [`firefighter-maps/`](firefighter-maps/). The old `firefighter-map/` folder just redirects to the detailed one, for existing links.

### [Detailed](https://investinopen.github.io/ptps-wildfire-demo/firefighter-maps/detailed/)

A printable map for small/rural fire departments, in [`firefighter-maps/detailed/`](firefighter-maps/detailed/) -- a plain HTML page with its own layout, rather than rendered by Quarto.

Its water sources and road access (one-way streets, gates, dead ends, bridge weight limits) come from OpenStreetMap, in a PMTiles file built ahead of time rather than queried live:

1. [`build-access-tiles.yml`](../.github/workflows/build-access-tiles.yml) runs daily, and whenever the extractor changes. It downloads [Geofabrik](https://download.geofabrik.de/north-america/us.html)'s US extract (about 12 GB), filters it down with [osmium-tool](https://osmcode.org/osmium-tool/) to what the map uses, clips it to the map's bounds, extracts the layers with [`access_tiles.py`](../ptps_wildfire_demo/access_tiles.py) (which also works out where the dead ends are), and builds `osm-access.pmtiles` with [tippecanoe](https://github.com/felt/tippecanoe). It takes 30+ minutes, and the tiles are uploaded as an artifact rather than committed.
1. [`publish-site.yml`](../.github/workflows/publish-site.yml) downloads the latest successful build's tiles into the map's folder each time it publishes, and publishes again whenever a build finishes. A site change doesn't wait for a build, so it goes out with the last tiles built; changing what's in the tiles means adding the new layer or property first, then switching the map to it once a build has run.

So OSM edits show up on the map the day after they're made. The tiles' attribution says what date their data is from.

To preview the map locally, get a copy of the tiles (or [build some](../.github/workflows/build-access-tiles.yml) from a smaller extract, like a state's), then serve `site/` with a server that supports the byte-range requests PMTiles uses, rather than Quarto's preview:

```sh
curl -o site/firefighter-maps/detailed/osm-access.pmtiles https://investinopen.github.io/ptps-wildfire-demo/firefighter-maps/detailed/osm-access.pmtiles
npx http-server@14.1.1 site -c-1
```

### [Simplified](https://investinopen.github.io/ptps-wildfire-demo/firefighter-maps/simplified/)

A simplified map for navigation ([#22](https://github.com/investinopen/ptps-wildfire-demo/issues/22)): the roads around a rural town drawn as a graph of intersections and the roads between them, each drawn with its length proportional to its driving distance, colored by its steepest grade, and with sharp turns, dead ends, gates, and addresses marked. Roads come from OpenStreetMap via [OSMnx](https://osmnx.readthedocs.io/), and elevation from [Mapterhorn](https://mapterhorn.com/)'s terrain tiles. It's [`firefighter-maps/simplified/index.qmd`](firefighter-maps/simplified/index.qmd), which just shows the results -- change the place passed to `SimplifiedMap.build()` to move it. Its code is in [`ptps_wildfire_demo/simplified_map/`](../ptps_wildfire_demo/simplified_map/), starting from [`pipeline.py`](../ptps_wildfire_demo/simplified_map/pipeline.py) (which has the settings), with tests in [`tests/test_simplified_map.py`](../tests/test_simplified_map.py).
