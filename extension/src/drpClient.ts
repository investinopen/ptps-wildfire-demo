import browser from "webextension-polyfill";
import { DRP_BASE_URL, DRP_DATASETS_URL } from "./constants";
import type { DrpRow } from "./types";

const STORAGE_KEY = "drpRows";

async function fetchDrpDataset(): Promise<DrpRow[]> {
  const response = await fetch(DRP_DATASETS_URL);
  return (await response.json()) as DrpRow[];
}

/** Mirrors Resolver.refresh: re-downloads https://portal.datarescueproject.org/datasets-full.json */
export async function refreshDrpCache(): Promise<void> {
  const rows = await fetchDrpDataset();
  await browser.storage.local.set({ [STORAGE_KEY]: rows });
}

export async function getDrpRows(): Promise<DrpRow[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const rows = stored[STORAGE_KEY];
  if (Array.isArray(rows)) return rows as DrpRow[];

  await refreshDrpCache();
  const refreshed = await browser.storage.local.get(STORAGE_KEY);
  return (refreshed[STORAGE_KEY] as DrpRow[] | undefined) ?? [];
}

function getDrpExactMatch(rows: DrpRow[], url: string): DrpRow | null {
  return rows.find((row) => row.data_source === url) ?? null;
}

/** Mirrors Resolver.get_drp_partial_match: finds the longest data_source contained in url. */
function getDrpPartialMatch(rows: DrpRow[], url: string): DrpRow | null {
  let best: DrpRow | null = null;
  let bestLength = -1;

  for (const row of rows) {
    const source = row.data_source;
    if (!source || !url.includes(source)) continue;
    if (source.length > bestLength) {
      best = row;
      bestLength = source.length;
    }
  }

  return best;
}

/** Mirrors Resolver.get_drp_match: favors exact matches, falling back to partial matches. */
export function getDrpMatch(rows: DrpRow[], url: string): DrpRow | null {
  return getDrpExactMatch(rows, url) ?? getDrpPartialMatch(rows, url);
}

/** Mirrors Resolver.get_drp_url. */
export async function getDrpUrl(url: string): Promise<string | null> {
  const rows = await getDrpRows();
  const match = getDrpMatch(rows, url);
  return match?.url ? `${DRP_BASE_URL}${match.url}` : null;
}
