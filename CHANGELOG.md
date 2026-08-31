# Changelog

## 2026-08-30 to 2026-08-31

- **Browser extension:**
  - Established the initial extension with tests and build instructions.
  - Added and refined Data Rescue Portal links, match-only overlays, and a modal experience.

    ![modal showing over the EPA EJScreener](img/extension_modal_2026-08-31.png)

  - Added extension documentation, tests, and GitHub Actions coverage.
  - Prevented duplicate pull-request builds.

- **HTTP proxy:**
  - Improved rescued-dataset matching, redirect handling, timeout and server-failure recovery, and duplicate-request avoidance.
  - Moved fallback discovery fully into the proxy.
  - Improved fallback responses for JSON clients and limited passive Internet Archive saves to GET requests.
- **Wildfire analysis:** Expanded rescue-status analysis and updated its datasets and notebook output.

## 2026-08-28

- **HTTP proxy:** Switched rescue-data discovery to the Data Rescue Portal dataset endpoint.
- Reworked wildfire dataset status analysis around a CSV source, broader URL coverage, and rescue-status reporting.

## 2026-08-21 to 2026-08-24

- **HTTP proxy:**
  - Added Data Rescue Project URL resolution and consolidated response-error handling.
  - Added coverage-enabled tests and a proxy-free demo.
  - Added Wayback Machine lookup to the fallback flow and improved resolver, event-loop, URL, and proxy configuration handling.
  - Reorganized modules and surfaced metadata and all fallback URLs.
  - Improved handling of Internet Archive timeouts and connection failures.
  - Introduced `Rescue` and `InternetArchiveClient` abstractions, Internet Archive authentication, conditional passive archiving, and component-status reporting.
  - Refined dependency organization, logging, and tests.
- **Wildfire analysis:**
  - Reorganized the project README and moved wildfire analysis into its own directory.
  - Added rescued-data status exploration.
  - Expanded the wildfire dataset inventory.
  - Refined analysis documentation.

## 2026-08-18 to 2026-08-20

- **HTTP proxy:**
  - Added mitmproxy usage documentation and pytest-based proxy and curl tests.
  - Delivered the initial mitmproxy fallback addon with custom error messaging.
  - Added proxy integration tests, debugging support, and GitHub Actions test automation.
  - Added a demo and documented minimal fallback behavior.
- **Browser extension:** Proposed the extension direction.

## 2026-08-04 to 2026-08-10

- **Wildfire analysis:**
  - Added initial DuckDB setup, the Open Climate Risk notebook, and a simplified analysis workflow.
  - Added FIRMS active-fire queries and Source Cooperative Data Proxy setup; corrected OCR data retrieval.
  - Added native DuckDB notebook connectivity, Parquet-backed burn-probability data, and initial wildfire-risk queries.
  - Created DuckDB views for wildfire sources, documented their metadata, and configured memory limits and HTTP caching.
  - Added nationwide fire-risk data retrieval, state boundaries and risk mapping, burn-probability visualizations, and streamlined data-processing notebooks.
  - Added nationwide burn-probability data and percentile-based views.
  - Added red-flag alert mapping and improved map output.

## 2026-07-29

- Initialized the project.
