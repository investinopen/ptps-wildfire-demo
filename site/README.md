# GitHub Pages site

A [homepage](index.qmd) introducing the project, the [fallback tools](fallbacks.qmd), the [dataset rescue status report](analysis/rescue-status.qmd), the [risk](analysis/risk.ipynb) and [wildfire overlap](analysis/fire_overlap.ipynb) notebooks, and the [detailed](#detailed) and [simplified](#simplified) [firefighter maps](#firefighter-maps) are published together as a [Quarto](https://quarto.org/) website, configured in [`_quarto.yml`](_quarto.yml). The rescue status report and the two notebooks live in [`analysis/`](analysis/#readme), along with the notebooks that aren't pages. The pages that run against live data (the rescue status report, the two notebooks, and the simplified firefighter map) are [re-executed daily](../.github/workflows/refresh-notebooks.yml) and whenever their code changes, so their live layers stay current. The site is [published](../.github/workflows/publish-site.yml) after each of those refreshes and whenever it changes, using the latest refreshed results rather than executing anything itself -- so if a data source is down, the pages just stay as of the last refresh. To preview locally, [install Quarto](https://quarto.org/docs/get-started/), then from the repository root run:

```sh
uv run quarto preview site
```

## Firefighter maps

Both in [`firefighter-maps/`](firefighter-maps/). The old `firefighter-map/` folder just redirects to the detailed one, for existing links.

### [Detailed](https://investinopen.github.io/ptps-wildfire-demo/firefighter-maps/detailed/)

A printable map for small/rural fire departments, in [`firefighter-maps/detailed/`](firefighter-maps/detailed/) -- a plain HTML page with its own layout, rather than rendered by Quarto.

### [Simplified](https://investinopen.github.io/ptps-wildfire-demo/firefighter-maps/simplified/)

A simplified map for navigation ([#22](https://github.com/investinopen/ptps-wildfire-demo/issues/22)): the roads around a rural town drawn as a graph of intersections and the roads between them, each drawn with its length proportional to its driving distance, colored by its steepest grade, and with sharp turns, dead ends, gates, and addresses marked. Roads come from OpenStreetMap via [OSMnx](https://osmnx.readthedocs.io/), and elevation from [Mapterhorn](https://mapterhorn.com/)'s terrain tiles. It's the notebook [`firefighter-maps/simplified/index.ipynb`](firefighter-maps/simplified/index.ipynb), which just shows the results -- change the place passed to `SimplifiedMap.build()` to move it. Its code is in [`ptps_wildfire_demo/simplified_map/`](../ptps_wildfire_demo/simplified_map/), starting from [`pipeline.py`](../ptps_wildfire_demo/simplified_map/pipeline.py) (which has the settings), with tests in [`tests/test_simplified_map.py`](../tests/test_simplified_map.py).
