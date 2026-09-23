// map symbols drawn on a canvas, so the same drawing can be registered as a map image
// (see main.js) and shown as its legend swatch (see legend.js). All black/white/yellow,
// so they stay readable when printed in grayscale.

// drawn at 2x and registered with pixelRatio 2, so they stay crisp on high-DPI screens
// and in print
export const ICON_PIXEL_RATIO = 2;

// a small right-pointing arrow -- line-placed symbols orient a 0deg icon along the
// line's own direction, so "right" is the convention
const drawArrow = (ctx, size) => {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = size / 14;
  ctx.beginPath();
  ctx.moveTo(size / 7, size / 7);
  ctx.lineTo(size - size / 7, size / 2);
  ctx.lineTo(size / 7, size - size / 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

// a gate/barrier across the road: a bar in a circle, like a "no entry" sign in black
const drawGate = (ctx, size) => {
  const r = size / 2;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = size / 10;
  ctx.beginPath();
  ctx.arc(r, r, r - ctx.lineWidth / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.fillRect(size * 0.22, size * 0.42, size * 0.56, size * 0.16);
};

// a dead end with no turnaround: the US "dead end"/"no outlet" sign -- a black T on a
// yellow diamond
const drawDeadEnd = (ctx, size) => {
  const r = size / 2;
  ctx.fillStyle = "#ffd200";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = size / 12;
  ctx.beginPath();
  ctx.moveTo(r, ctx.lineWidth / 2);
  ctx.lineTo(size - ctx.lineWidth / 2, r);
  ctx.lineTo(r, size - ctx.lineWidth / 2);
  ctx.lineTo(ctx.lineWidth / 2, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#000000";
  // the T's crossbar, then its stem
  ctx.fillRect(size * 0.3, size * 0.3, size * 0.4, size * 0.1);
  ctx.fillRect(size * 0.45, size * 0.3, size * 0.1, size * 0.38);
};

// a box with a border, stretched to fit a label (a weight limit or route number) like a road sign -- see SIGN_BOX_OPTIONS
const drawBox = (fill, border) => (ctx, size) => {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = border;
  ctx.lineWidth = ICON_PIXEL_RATIO;
  ctx.strokeRect(1, 1, size - 2, size - 2);
};

// size is in CSS pixels
export const ICONS = {
  "oneway-arrow": { draw: drawArrow, size: 14 },
  gate: { draw: drawGate, size: 14 },
  "dead-end": { draw: drawDeadEnd, size: 16 },
  // stretchable ones get SIGN_BOX_OPTIONS when registered (see main.js)
  "sign-box": {
    draw: drawBox("#ffffff", "#000000"),
    size: 16,
    stretchable: true,
  },
  // draws nothing -- only takes up space, so other labels avoid it (see the *_OBSTACLES_LAYERs in layers.js)
  obstacle: { draw: () => {}, size: 10 },
  // Interstate blue
  "interstate-box": {
    draw: drawBox("#1f4e9c", "#ffffff"),
    size: 16,
    stretchable: true,
  },
};

// only stretch the box's interior, so its border stays 1px thick however wide the text is
// https://maplibre.org/maplibre-style-spec/sprite/#stretchx
const boxInset = 3 * ICON_PIXEL_RATIO;
const boxSize = ICONS["sign-box"].size * ICON_PIXEL_RATIO;
export const SIGN_BOX_OPTIONS = {
  stretchX: [[boxInset, boxSize - boxInset]],
  stretchY: [[boxInset, boxSize - boxInset]],
  content: [boxInset, boxInset, boxSize - boxInset, boxSize - boxInset],
};

const drawIcon = (canvas, name) => {
  const { draw, size } = ICONS[name];
  canvas.width = canvas.height = size * ICON_PIXEL_RATIO;
  const ctx = canvas.getContext("2d");
  draw(ctx, size * ICON_PIXEL_RATIO);
  return ctx;
};

// for map.addImage()
export const iconImageData = (name) => {
  const { size } = ICONS[name];
  const px = size * ICON_PIXEL_RATIO;
  return drawIcon(new OffscreenCanvas(px, px), name).getImageData(0, 0, px, px);
};

// for a legend swatch's background-image
export const iconDataUrl = (name) =>
  drawIcon(document.createElement("canvas"), name).canvas.toDataURL();
