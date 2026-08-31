/**
 * Injected into the target page via browser.scripting.executeScript, so it must be
 * self-contained — it cannot close over anything outside its own arguments.
 */
export function showFallbackOverlay(drpUrl: string): void {
  const bannerId = "ptps-wildfire-demo-fallback-banner";
  if (document.getElementById(bannerId)) return;

  const banner = document.createElement("div");
  banner.id = bannerId;
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
  } satisfies Partial<CSSStyleDeclaration>);

  const link = document.createElement("a");
  link.href = drpUrl;
  link.textContent = "This data has been rescued.";
  link.style.color = "inherit";
  banner.appendChild(link);

  document.documentElement.appendChild(banner);
}
