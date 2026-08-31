# Changelog

## 2026-08-31

- **Browser extension:**
  - Added and refined Data Rescue Portal links, match-only overlays, and a modal experience.
  - Added extension documentation, tests, and GitHub Actions coverage.
  - Prevented duplicate pull-request builds.
- **HTTP proxy:** Improved fallback responses for JSON clients and limited passive Internet Archive saves to GET requests.

## 2026-08-30

- **HTTP proxy:**
  - Improved rescued-dataset matching, redirect handling, timeout and server-failure recovery, and duplicate-request avoidance.
  - Moved fallback discovery fully into the proxy.
- **Browser extension:** Established the initial extension with tests and build instructions.
- **Wildfire analysis:** Expanded rescue-status analysis and updated its datasets and notebook output.

## 2026-08-28

- **HTTP proxy:** Switched rescue-data discovery to the Data Rescue Portal dataset endpoint.
- Reworked wildfire dataset status analysis around a CSV source, broader URL coverage, and rescue-status reporting.

## 2026-08-24

- **HTTP proxy:**
  - Improved handling of Internet Archive timeouts and connection failures.
  - Introduced `Rescue` and `InternetArchiveClient` abstractions, Internet Archive authentication, conditional passive archiving, and component-status reporting.
  - Refined dependency organization, logging, and tests.
- **Wildfire analysis:**
  - Expanded the wildfire dataset inventory.
  - Refined analysis documentation.

## 2026-08-23

- **HTTP proxy:**
  - Added Wayback Machine lookup to the fallback flow and improved resolver, event-loop, URL, and proxy configuration handling.
  - Reorganized modules and surfaced metadata and all fallback URLs.
- **Wildfire analysis:** Added rescued-data status exploration.

## 2026-08-22

- **HTTP proxy:**
  - Added Data Rescue Project URL resolution and consolidated response-error handling.
  - Added coverage-enabled tests and a proxy-free demo.

## 2026-08-21

- Reorganized the project README and moved wildfire analysis into its own directory.

## 2026-08-20

- **HTTP proxy:** Added a demo and documented minimal fallback behavior.
- **Browser extension:** Proposed the extension direction.

## 2026-08-19

- **HTTP proxy:**
  - Delivered the initial mitmproxy fallback addon with custom error messaging.
  - Added proxy integration tests, debugging support, and GitHub Actions test automation.

## 2026-08-18

- **HTTP proxy:**
  - Added mitmproxy usage documentation.
  - Added pytest-based proxy and curl tests.

## 2026-08-10

- **Wildfire analysis:**
  - Added nationwide burn-probability data and percentile-based views.
  - Added red-flag alert mapping and improved map output.

## 2026-08-09

- **Wildfire analysis:**
  - Added nationwide fire-risk data retrieval, state boundaries and risk mapping, and burn-probability visualizations.
  - Streamlined data-processing notebooks.

## 2026-08-08

- **Wildfire analysis:**
  - Created DuckDB views for wildfire sources and documented their metadata.
  - Configured memory limits and HTTP caching.

## 2026-08-07

- **Wildfire analysis:**
  - Added native DuckDB notebook connectivity and Parquet-backed burn-probability data.
  - Added initial wildfire-risk queries.

## 2026-08-06

- **Wildfire analysis:**
  - Added FIRMS active-fire queries and Source Cooperative Data Proxy setup.
  - Corrected OCR data retrieval.

## 2026-08-05

- **Wildfire analysis:**
  - Added the Open Climate Risk notebook.
  - Simplified the analysis workflow.

## 2026-08-04

- Added initial DuckDB setup for wildfire analysis.

## 2026-07-29

- Initialized the project.
