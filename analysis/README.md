# Analysis

## [Wildfire risk](risk.ipynb)

Brings four datasets of very different velocity together on one map, and ranks a state's
NWS fire weather zones by a composite of standing hazard and current conditions:

| Layer                  | Source                           | Velocity |
| ---------------------- | -------------------------------- | -------- |
| Burn probability       | CarbonPlan Open Climate Risk     | static   |
| Burn history           | MTBS perimeters 1984-2024        | static   |
| Red Flag Warnings      | NOAA/NWS active alerts API       | minutes  |
| Active fire detections | NASA FIRMS (MODIS 24h)           | hours    |

Each layer is a DuckDB view over the remote file ([`views.sql`](views.sql)), and the joins
and geometry work happen in SQL through the `spatial` extension. Set `STATE` in the
configuration cell to move it; one state keeps every layer small enough to work
interactively.

Requires [DuckDB](https://duckdb.org/).

For Python dependencies managed with `uv`, use a regular CPython build (for example `3.14.6`), not a free-threaded build (for example `3.14.6t` / `3.14.6+freethreaded`). Some binary packages used by this project (such as `lonboard` -> `geoarrow-rust-core`) do not currently publish free-threaded wheels.

1. [Download the burn probability data.](burn_prob.ipynb)
1. [Run the analysis.](risk.ipynb)

The first run binds every view, which means fetching from every endpoint and takes a few
minutes; afterwards `cache_httpfs` serves them and the whole notebook runs in seconds.
Each run writes a timestamped CSV, GeoJSON, and provenance JSON -- because two of the four
layers change by the hour, re-running does not reproduce an earlier result.

## Dataset rescue status report

[`generate_report.py`](generate_report.py) checks the rescue status of the example data sources and writes the results to a standalone `fire-datasets-report.html` page with clickable links.

From the repository root, run:

```sh
uv run python -m analysis.generate_report
```

Then open the generated `fire-datasets-report.html` in a browser.

The report is also [published automatically to GitHub Pages](../.github/workflows/publish-report.yml).

## [Data Rescue Project datasets](rescues.ipynb)

Check the statuses of source data archived by the [Data Rescue Project](https://www.datarescueproject.org/).

## [Federal Data Terminations](federal_data_terminations.ipynb)

Looking at the rescue status of terminated federal datasets.
