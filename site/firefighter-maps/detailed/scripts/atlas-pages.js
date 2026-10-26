// The printed pages of an atlas (see atlas.js): an index page with the area and its numbered pages, then each page of the map with a copy of the sidebar (legend, scale, attribution) beside it, a key map showing where it is, and the numbers of the pages next to it at its edges.

// the map on each page and on the index page, in CSS pixels -- filling a US Letter landscape page within the print margins (the 10.2 x 7.6 in, or 979 x 729 px, .atlas-page in index.css) beside the print sidebar (245 px with its padding and border) or under the index's heading, less a few pixels so rounding can't spill a page onto a second sheet
export const PAGE_MAP_SIZE = { width: 730, height: 728 };
export const INDEX_MAP_SIZE = { width: 974, height: 620 };

const SVG_NS = "http://www.w3.org/2000/svg";

const element = (name, attributes = {}, children = []) => {
  const el = document.createElement(name);
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
};

const svgElement = (name, attributes = {}, children = []) => {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
};

// The index map's image with the area's outline and the pages over it -- numbered, or with just `current` filled in, for the small key map on each page.
const keyMap = ({ image, outline, rects }, pages, { numbered, current }) => {
  const { width, height } = INDEX_MAP_SIZE;
  const boxes = pages.map(({ row, col, number }) => {
    const { x, y, width: w, height: h } = rects.get(`${row},${col}`);
    const box = svgElement("rect", {
      x,
      y,
      width: w,
      height: h,
      class: number === current ? "current" : "",
    });
    if (!numbered) return box;
    const label = svgElement(
      "text",
      {
        x: x + w / 2,
        y: y + h / 2,
        // capped, so a few big pages on the index don't get numbers that cover the map
        "font-size": Math.min(w * 0.4, h * 0.4, 32),
      },
      [String(number)],
    );
    return svgElement("g", {}, [box, label]);
  });
  return svgElement(
    "svg",
    {
      viewBox: `0 0 ${width} ${height}`,
      class: numbered ? "atlas-index-map" : "atlas-key-map",
      role: "img",
      "aria-label": numbered
        ? "The area, split into numbered pages"
        : `Where page ${current} is in the area`,
    },
    [
      svgElement("image", { href: image, width, height }),
      svgElement("rect", { ...outline, class: "outline" }),
      ...boxes,
    ],
  );
};

export const indexPage = ({ title, details, index, pages }) => {
  const attribution = element("div", { class: "map-attribution" });
  attribution.innerHTML = index.attribution;
  return element("section", { class: "atlas-page atlas-index" }, [
    element("header", {}, [
      element("h1", {}, [title]),
      element("p", {}, [details]),
    ]),
    keyMap(index, pages, { numbered: true }),
    attribution,
  ]);
};

// A copy of the sidebar as it is now (so with the current scale, attribution, buildings key, and which layers are on), minus what's only for the screen, without ids so they stay unique on the page. Taken while each page is on screen (see atlas.js), since all of those depend on the view.
export const sidebarCopy = () => {
  const sidebar = document.getElementById("sidebar");
  const copy = sidebar.cloneNode(true);
  // a copied checkbox gets its default checked state rather than its current one
  const boxes = sidebar.querySelectorAll("input[type=checkbox]");
  copy
    .querySelectorAll("input[type=checkbox]")
    .forEach((box, i) => (box.checked = boxes[i].checked));
  copy
    .querySelectorAll(
      "#place-search, #atlas-open, #data-delay-note, #overview-map",
    )
    .forEach((el) => el.remove());
  for (const el of [copy, ...copy.querySelectorAll("[id]")]) {
    el.removeAttribute("id");
  }
  return copy;
};

// "↑ 3" etc. at the map's edges, for the pages next to this one
const neighborLabels = (neighbors) =>
  Object.entries(neighbors).map(([side, number]) =>
    element(
      "span",
      {
        class: `atlas-neighbor ${side}`,
        "aria-label": `continues ${side} on page ${number}`,
      },
      [`${{ north: "↑", south: "↓", east: "→", west: "←" }[side]} ${number}`],
    ),
  );

export const mapPage = ({ title, page, total, index, pages }) => {
  const { sidebar } = page;
  const heading = sidebar.querySelector(".map-places");
  heading.hidden = false;
  // the town(s) on this page, or the whole area's if it has none of its own
  heading.textContent = page.places || title;
  heading.after(
    element("p", { class: "atlas-page-number" }, [
      `Page ${page.number} of ${total}`,
    ]),
    keyMap(index, pages, { numbered: false, current: page.number }),
  );
  sidebar.append(
    element("p", { class: "atlas-disclaimer" }, [
      document
        .getElementById("disclaimer-banner")
        .textContent.replace(/\s+/g, " ")
        .trim(),
    ]),
  );
  return element("section", { class: "atlas-page" }, [
    sidebar,
    element("div", { class: "atlas-map" }, [
      element("img", {
        src: page.image,
        alt: `Map page ${page.number}`,
        width: PAGE_MAP_SIZE.width,
        height: PAGE_MAP_SIZE.height,
      }),
      ...neighborLabels(page.neighbors),
    ]),
  ]);
};
