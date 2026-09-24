# Analysis

## Data

The notebooks' static inputs in [`data/`](data/) are stored with [Git LFS](https://git-lfs.com/). Install it (`brew install git-lfs && git lfs install`) before cloning, or run `git lfs pull` in an existing clone. The download notebooks linked below are only needed to refresh that data or to change `STATE`.

## [Wildfire risk](risk.ipynb)

Brings four datasets of very different velocity together on one map, and ranks a state's
NWS fire weather zones by a composite of standing hazard and current conditions:

| Layer                  | Source                       | Velocity |
| ---------------------- | ---------------------------- | -------- |
| Burn probability       | CarbonPlan Open Climate Risk | static   |
| Burn history           | MTBS perimeters 1984-2024    | static   |
| Red Flag Warnings      | NOAA/NWS active alerts API   | minutes  |
| Active fire detections | NASA FIRMS (MODIS 24h)       | hours    |

Each layer is a DuckDB view over the remote file ([`views.sql`](views.sql)), and the joins
and geometry work happen in SQL through the `spatial` extension. Set `STATE` in the
configuration cell to move it; one state keeps every layer small enough to work
interactively.

Requires [DuckDB](https://duckdb.org/).

For Python dependencies managed with `uv`, use a regular CPython build (for example `3.14.6`), not a free-threaded build (for example `3.14.6t` / `3.14.6+freethreaded`). Some binary packages used by this project (such as `lonboard` -> `geoarrow-rust-core`) do not currently publish free-threaded wheels.

1. [Download the burn probability data.](burn_prob.ipynb) Already in [`data/`](#data).
1. [Run the analysis.](risk.ipynb)

The first run binds every view, which means fetching from every endpoint and takes a few
minutes; afterwards `cache_httpfs` serves them and the whole notebook runs in seconds.
Because two of the four layers change by the hour, re-running does not reproduce an
earlier result, and nothing is written to disk -- capture anything you want to keep.

## [Wildfire overlap](fire_overlap.ipynb)

Draws every mapped fire perimeter in a state since 1984 as a translucent polygon on one map, so places that have burned more than once show up darker where perimeters stack. Perimeters come from [WUMI](https://datadryad.org/dataset/doi:10.5061/dryad.63xsj3vd4), a merge of MTBS, CalFire, USGS, WFIGS, and IAFPH.

1. [Download the fire perimeters.](wumi_perimeters.ipynb) Already in [`data/`](#data) for Wyoming. Dryad's website sits behind bot detection, but its REST API doesn't -- this step needs a [Dryad API account](https://datadryad.org/api#?route=overview--api-accounts) (`DRYAD_CLIENT_ID`/`DRYAD_SECRET` in `.env`; see `.env.sample`) rather than a manual download.
1. [Run the analysis.](fire_overlap.ipynb)

## [Road graph](road_graph.ipynb)

A simplified map for navigation ([#22](https://github.com/investinopen/ptps-wildfire-demo/issues/22)): the roads around a rural town drawn as a graph of intersections and the roads between them, each drawn with its length proportional to its driving distance, colored by its steepest grade, and with sharp turns, dead ends, gates, and addresses marked. Roads come from OpenStreetMap via [OSMnx](https://osmnx.readthedocs.io/), and elevation from [Mapterhorn](https://mapterhorn.com/)'s terrain tiles. Set `PLACE_NAME`/`CENTER` in the configuration cell to move it.

## Dataset rescue status report

[`generate_report.py`](generate_report.py) checks the rescue status of the [example data sources](fire_datasets.csv). It's run by [`rescue-status.qmd`](rescue-status.qmd) whenever the site is rendered.

## [Data Rescue Project datasets](rescues.ipynb)

Check the statuses of source data archived by the [Data Rescue Project](https://www.datarescueproject.org/).

## [Federal Data Terminations](federal_data_terminations.ipynb)

Looking at the rescue status of terminated federal datasets.
