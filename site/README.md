# GitHub Pages site

A [homepage](index.qmd) introducing the project, the [fallback tools](fallbacks.qmd), the [dataset rescue status report](analysis/rescue-status.qmd), the [risk](analysis/risk.ipynb) and [wildfire overlap](analysis/fire_overlap.ipynb) notebooks, the [firefighter map](firefighter-map/), and the [road graph](#road-graph) are published together as a [Quarto](https://quarto.org/) website, configured in [`_quarto.yml`](_quarto.yml). The rescue status report and the two notebooks live in [`analysis/`](analysis/#readme), along with the notebooks that aren't pages. The pages that run against live data (the rescue status report, the two notebooks, and the road graph) are [re-executed daily](../.github/workflows/refresh-notebooks.yml) and whenever their code changes, so their live layers stay current. The site is [published](../.github/workflows/publish-site.yml) after each of those refreshes and whenever it changes, using the latest refreshed results rather than executing anything itself -- so if a data source is down, the pages just stay as of the last refresh. To preview locally, [install Quarto](https://quarto.org/docs/get-started/), then from the repository root run:

```sh
uv run quarto preview site
```

## [Firefigher map](https://investinopen.github.io/ptps-wildfire-demo/firefighter-map/)

## [Road graph](road_graph.ipynb)

A simplified map for navigation ([#22](https://github.com/investinopen/ptps-wildfire-demo/issues/22)): the roads around a rural town drawn as a graph of intersections and the roads between them, each drawn with its length proportional to its driving distance, colored by its steepest grade, and with sharp turns, dead ends, gates, and addresses marked. Roads come from OpenStreetMap via [OSMnx](https://osmnx.readthedocs.io/), and elevation from [Mapterhorn](https://mapterhorn.com/)'s terrain tiles. Set `PLACE_NAME`/`CENTER` in the configuration cell to move it. Its code is in [`ptps_wildfire_demo/road_graph/`](../ptps_wildfire_demo/road_graph/), with tests in [`tests/test_road_graph.py`](../tests/test_road_graph.py).
