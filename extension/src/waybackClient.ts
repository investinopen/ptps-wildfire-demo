import {
  WAYBACK_AVAILABLE_URL,
  WAYBACK_SAVE_BASE_URL,
  WAYBACK_LOOKUP_TIMEOUT_MS,
} from "./constants";

/** Mirrors InternetArchiveClient.get_match: https://archive.org/help/wayback_api.php */
export async function getWaybackMatch(url: string): Promise<string | null> {
  const endpoint = new URL(WAYBACK_AVAILABLE_URL);
  endpoint.searchParams.set("url", url);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WAYBACK_LOOKUP_TIMEOUT_MS,
  );

  try {
    const response = await fetch(endpoint.toString(), {
      signal: controller.signal,
    });
    const data = await response.json();
    return data?.archived_snapshots?.closest?.url ?? null;
  } catch (error) {
    console.warn("Unable to reach the Internet Archive", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Mirrors InternetArchiveClient.save: https://help.archive.org/help/save-pages-in-the-wayback-machine/ */
export async function saveToWayback(
  url: string,
): Promise<Response | undefined> {
  try {
    return await fetch(`${WAYBACK_SAVE_BASE_URL}${url}`);
  } catch (error) {
    console.warn(`Unable to save ${url} to the Internet Archive`, error);
    return undefined;
  }
}
