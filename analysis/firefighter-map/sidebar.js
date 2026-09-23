// the button that collapses/expands the sidebar (the legend, scale, and attribution), so the map can take the whole width. Remembered per browser; the sidebar always shows in print regardless (see index.html).
const STORAGE_KEY = "firefighter-map:sidebar-collapsed";

// localStorage can be unavailable (e.g. blocked in a private window), in which case it just isn't remembered
const load = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};
const save = (collapsed) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // not remembered
  }
};

export const bindSidebarToggle = () => {
  const container = document.getElementById("map-container");
  const button = document.getElementById("sidebar-toggle");
  const show = (collapsed) => {
    container.classList.toggle("sidebar-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? "»" : "«";
    button.title = collapsed ? "Show legend" : "Hide legend";
    button.setAttribute("aria-label", button.title);
  };
  show(load());
  // the map notices its container changing size on its own, and resizes to fill it
  button.addEventListener("click", () => {
    const collapsed = !container.classList.contains("sidebar-collapsed");
    show(collapsed);
    save(collapsed);
  });
};
