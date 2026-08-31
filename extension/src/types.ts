/** Mirrors ptps_wildfire_demo/proxy/rescue.py's Rescue dataclass, minus the Internet Archive fields. */
export interface Rescue {
  originalUrl: string;
  /** Like originalUrl, but after following any redirects. */
  resolvedUrl: string;
  drpUrl: string | null;
}

/** A single row from https://portal.datarescueproject.org/datasets-full.json */
export interface DrpRow {
  data_source: string | null;
  url: string | null;
}
