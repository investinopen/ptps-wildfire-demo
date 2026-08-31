import { HEAD_RESOLVE_TIMEOUT_MS } from "./constants";
import { getDrpUrl } from "./drpClient";
import type { Rescue } from "./types";

/** Mirrors Resolver.resolve: gets the URL after following any redirects. */
export async function resolveUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEAD_RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    return response.url || url;
  } catch {
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

/** Mirrors Resolver.get_rescue, minus the Internet Archive lookup. */
export async function getRescue(url: string): Promise<Rescue> {
  const resolvedUrl = await resolveUrl(url);

  let drpUrl = await getDrpUrl(url);
  if (!drpUrl && resolvedUrl !== url) {
    drpUrl = await getDrpUrl(resolvedUrl);
  }

  return { originalUrl: url, resolvedUrl, drpUrl };
}
