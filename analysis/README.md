This code was written to explore various relevant datasets in different formats, experimenting with how to bring them together in a cohesive way.

Requires [DuckDB](https://duckdb.org/).

For Python dependencies managed with `uv`, use a regular CPython build (for example `3.14.6`), not a free-threaded build (for example `3.14.6t` / `3.14.6+freethreaded`). Some binary packages used by this project (such as `lonboard` -> `geoarrow-rust-core`) do not currently publish free-threaded wheels.

1. [Download the burn probability data.](burn_prob.ipynb)
1. [Run the analysis.](risk.ipynb)

## Dataset rescue status report

[`generate_report.py`](generate_report.py) checks the rescue status of the example data sources (the same checks as [`fire_datasets.ipynb`](fire_datasets.ipynb)) and writes the results to a standalone `fire-datasets-report.html` page with clickable links.

From the `analysis/` directory, run:

```sh
uv run python generate_report.py
```

Then open the generated `fire-datasets-report.html` in a browser.
