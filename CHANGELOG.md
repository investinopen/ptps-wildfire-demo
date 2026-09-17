# Changelog

Only includes notable updates.

## 2026-09-17

- **[Wildfire risk map:](analysis/README.md#firefigher-map)** [Published a printable map](https://investinopen.github.io/ptps-wildfire-demo/firefighter-map/) meant to be handed to small/rural fire departments, combining building footprints, fuel load, fire hydrants, roads, driveways, and trails for an area.
  - Show a legend that doubles as the layer toggle, and highlight moderate/high fuel load risk with a hatch pattern.
  - Add a "search for a place" box, and make the current view linkable.
  - Add a disclaimer that it's a proof of concept and hasn't been validated.
  - Tune it for printing (keep the legend fills, hide the layer toggles) and for mobile.
- [**Analysis:**](README.md#analysis)
  - [Rank a state's fire weather zones](analysis/risk.ipynb) by a composite of burn probability, burn history, active fire detections, and red flag warnings.
  - [Map every fire perimeter that's burned a state since 1984](analysis/fire_overlap.ipynb), using WUMI perimeters fetched from Dryad.
  - [Fuzzy-match terminated federal datasets](analysis/federal_data_terminations.ipynb) against Data Rescue Project rescues.
  - Show when the [dataset rescue status report](analysis/README.md#dataset-rescue-status-report) was generated, and fix a few example dataset URLs.
  - Consolidated the analysis documentation into [analysis/README.md](analysis/README.md).
- [**HTTP proxy:**](README.md#http-proxy) Documented [QGIS and httpx usage](README.md#usage) against the proxy, and made passive archiving more tolerant of slow sites.

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
  - Display the source and rescue status of each data URL and webpage. This is meant to mimic the status dashboard from [**@jring-o**'s prototype](https://github.com/jring-o/scsd).
  - [Publish a report to GitHub Pages.](analysis/README.md#dataset-rescue-status-report)

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
