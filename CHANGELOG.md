# Changelog

Only includes notable updates.

## 2026-08-31

- [**Browser extension:**](README.md#browser-extension) Introduced the extension, linking matched pages to the [Data Rescue Project Portal](https://portal.datarescueproject.org/datasets/) through a modal overlay.

  ![modal showing over the EPA EJScreener](img/extension_modal_2026-08-31.png)

- [**HTTP proxy:**](README.md#http-proxy)
  - Look for archives of redirect URLs, when archives of the original aren't available.
  - Respond with JSON when appropriate.
  - Introduce "passive archiving", saving the URL to the [Internet Archive](https://archive.org/) if the request is a GET and the URL isn't archived there already.
    - This pattern can be expanded to save data to other repositories, such as [Dryad](https://datadryad.org/) / [Source Cooperative](https://docs.source.coop/data-upload).
  - Improved URL matching.
  - Improved error handling.
- [**Analysis:**](README.md#analysis) Expanded the [wildfire dataset status analysis](analysis/fire_datasets.ipynb).
  - Include [all datasets](analysis/fire_datasets.csv) that don't require authentication.
  - Display the rescue status of each data URL and webpage.

## 2026-08-24

- [**HTTP proxy:**](README.md#http-proxy) Find rescued data in the [Data Rescue Project](https://portal.datarescueproject.org/datasets/) and [Wayback Machine](https://web.archive.org/).
- [**Analysis:**](README.md#analysis)
  - [Show the rescue status of the wildfire datasets.](analysis/fire_datasets.ipynb)
  - [Show the statuses of the source URLs archived by the Data Rescue Project.](analysis/rescues.ipynb)

## 2026-08-20

- [**HTTP proxy:**](README.md#http-proxy) Introduced the [mitmproxy](https://www.mitmproxy.org/) fallback addon. [Demo.](https://drive.google.com/file/d/1IuWQqmfLEJsdH916C8GE9MWRktg6EKA9/view?usp=drivesdk)

## 2026-08-10

- [**Analysis:**](README.md#analysis) Started [working with wildfire risk data](analysis/risk.ipynb).
  - Established a DuckDB- and notebook-based workflow for wildfire, burn-probability, active-fire, and climate-risk data.
  - Added nationwide risk and burn-probability visualizations, including state boundaries and red-flag alerts.

## 2026-07-29

- Initialized the project.
