# GitHub Pages site

A [homepage](index.qmd) introducing the project, the [fallback tools](fallbacks.qmd), the [dataset rescue status report](analysis/rescue-status.qmd), the [risk](analysis/risk.ipynb), [wildfire overlap](analysis/fire_overlap.ipynb), and [road graph](analysis/road_graph.ipynb) notebooks, and the [firefighter map](firefighter-map/) are published together as a [Quarto](https://quarto.org/) website, configured in [`_quarto.yml`](_quarto.yml). The rescue status report and the three notebooks live in [`analysis/`](analysis/#readme), along with the notebooks that aren't pages. The pages that run against live data (the rescue status report and the three notebooks) are [re-executed daily](../.github/workflows/refresh-notebooks.yml) and whenever their code changes, so their live layers stay current. The site is [published](../.github/workflows/publish-site.yml) after each of those refreshes and whenever it changes, using the latest refreshed results rather than executing anything itself -- so if a data source is down, the pages just stay as of the last refresh. To preview locally, [install Quarto](https://quarto.org/docs/get-started/), then from the repository root run:

```sh
uv run quarto preview site
```

## [Firefigher map](https://investinopen.github.io/ptps-wildfire-demo/firefighter-map/)
