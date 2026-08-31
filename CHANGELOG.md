# Changelog

Only includes notable updates.

## 2026-08-31

- **Browser extension:** Introduced the extension, linking matched pages to the Data Rescue Portal through a modal overlay.

  ![modal showing over the EPA EJScreener](img/extension_modal_2026-08-31.png)

- **HTTP proxy:**
  - Added support for JSON responses
  - Improved URL matching
  - Improved error handling
- **Wildfire analysis:** Expanded rescue-status analysis and updated its datasets and notebook output.

## 2026-08-28

- **HTTP proxy:**
  - Centralized fallback discovery
  - Improved URL matching
  - Look for archives of redirect URLs, when archives of the original aren't available
  - Improved error and JSON responses, plus passive archiving behavior.
- Reworked wildfire dataset status analysis around a CSV source, broader URL coverage, and rescue-status reporting.
- **HTTP proxy:**
  - Introduced the mitmproxy fallback addon and demo.
  - Added documentation, integration tests, and GitHub Actions automation.

## 2026-08-24

- **HTTP proxy:**
  - Added Data Rescue Project and Wayback Machine lookup to the fallback flow.
  - Improved resilience with reusable rescue and Internet Archive clients, authentication, error handling, and tests.
- **Wildfire analysis:** Reorganized the analysis workspace and expanded rescued-data status coverage.

## 2026-08-20

- **HTTP proxy:** Introduced the mitmproxy fallback addon, demo, documentation, integration tests, and GitHub Actions automation.
- **Browser extension:** Established the extension direction.

## 2026-08-10

- **Wildfire analysis:**
  - Established a DuckDB- and notebook-based workflow for wildfire, burn-probability, active-fire, and climate-risk data.
  - Added nationwide risk and burn-probability visualizations, including state boundaries and red-flag alerts.

## 2026-07-29

- Initialized the project.
