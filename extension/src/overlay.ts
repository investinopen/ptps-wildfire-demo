/**
 * Injected into the target page via browser.scripting.executeScript, so it must be
 * self-contained — it cannot close over anything outside its own arguments.
 */
export function showFallbackOverlay(drpUrl: string): void {
  const dialogId = "ptps-wildfire-demo-fallback-dialog";
  if (document.getElementById(dialogId)) return;

  const dialog = document.createElement("dialog");
  dialog.id = dialogId;
  Object.assign(dialog.style, {
    zIndex: "2147483647",
    border: "5px solid grey",
    borderRadius: "8px",
    padding: "24px 32px",
    fontFamily: "sans-serif",
    fontSize: "18px",
    textAlign: "center",
  } satisfies Partial<CSSStyleDeclaration>);

  const message = document.createElement("p");
  message.textContent = "This data has been rescued.";
  dialog.appendChild(message);

  const buttonStyle = {
    display: "inline-block",
    fontSize: "16px",
    padding: "8px 16px",
    borderRadius: "4px",
    textDecoration: "none",
    cursor: "pointer",
  } satisfies Partial<CSSStyleDeclaration>;

  const link = document.createElement("a");
  link.href = drpUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Get rescued data";
  Object.assign(link.style, buttonStyle, {
    backgroundColor: "blue",
    color: "white",
  } satisfies Partial<CSSStyleDeclaration>);
  link.addEventListener("click", () => dialog.close());
  dialog.appendChild(link);

  const ignoreLink = document.createElement("a");
  ignoreLink.href = "#";
  ignoreLink.textContent = "Ignore";
  Object.assign(ignoreLink.style, buttonStyle, {
    marginLeft: "8px",
    color: "inherit",
  } satisfies Partial<CSSStyleDeclaration>);
  ignoreLink.addEventListener("click", (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.appendChild(ignoreLink);

  document.documentElement.appendChild(dialog);
  dialog.showModal();
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove());
}
