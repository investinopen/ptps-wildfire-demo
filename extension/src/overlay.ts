import type { Rescue } from "./types";

/** Mirrors the response-rewriting branch of Fallback.response. */
export function buildFallbackMessage(
  statusCode: number,
  rescue: Rescue,
): string {
  const msg =
    statusCode === 404
      ? "That URL is no longer available."
      : "Unable to load that URL.";
  const fallbackUrls = [rescue.waybackNewestUrl, rescue.drpUrl].filter(
    (url): url is string => Boolean(url),
  );

  if (fallbackUrls.length === 0) return msg;
  return `${msg} Try:\n\n${fallbackUrls.join("\n\n")}`;
}

/**
 * Injected into the target page via browser.scripting.executeScript, so it must be
 * self-contained — it cannot close over anything outside its own arguments.
 */
export function showFallbackOverlay(message: string): void {
  const bannerId = "ptps-wildfire-demo-fallback-banner";
  if (document.getElementById(bannerId)) return;

  const banner = document.createElement("div");
  banner.id = bannerId;
  banner.textContent = message;
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483647",
    background: "#b91c1c",
    color: "#fff",
    padding: "12px 16px",
    fontFamily: "sans-serif",
    fontSize: "14px",
    whiteSpace: "pre-wrap",
  } satisfies Partial<CSSStyleDeclaration>);

  document.documentElement.appendChild(banner);
}
