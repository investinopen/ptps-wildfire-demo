# ptps-wildfire-demo

A networked data infrastructure demo for the "Investing in Open Infra to Safeguard Critical Scientific Data" project. Requires [DuckDB](https://duckdb.org/).

For Python dependencies managed with `uv`, use a regular CPython build (for example `3.14.6`), not a free-threaded build (for example `3.14.6t` / `3.14.6+freethreaded`). Some binary packages used by this project (such as `lonboard` -> `geoarrow-rust-core`) do not currently publish free-threaded wheels.

1. [Download the burn probability data.](burn_prob.ipynb)
1. Set up the database.

   ```sh
   duckdb -init setup.sql fire.duckdb < views.sql
   ```

1. [Run the analysis.](risk.ipynb)
