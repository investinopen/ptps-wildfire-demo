import math

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
from matplotlib import patheffects
from matplotlib.lines import Line2D
from matplotlib.markers import MarkerStyle
from matplotlib.transforms import Affine2D, Bbox
from mpl_toolkits.axes_grid1.anchored_artists import AnchoredSizeBar
from scipy.optimize import brentq
from shapely import LinearRing, LineString, Point, box

from ptps_wildfire_demo.simplified_map.network import TURNAROUNDS

FEET_PER_METER = 3.28084

# drawn thicker the bigger the road
WIDTHS = {"track": 1.6, "service": 1.6, "residential": 2.2, "unclassified": 2.2}
MAJOR_WIDTH = 3.5
GRADE_COLORS = ["#333333", "#e08a00", "#d0021b"]
TURN_MARKER = "$↺$"
NODE_STYLES = {
    "intersection": {
        "marker": "o",
        "s": 18,
        "color": "#333333",
        "label": "Intersection",
    },
    "dead end": {
        "marker": "X",
        "s": 90,
        "color": "#d0021b",
        "edgecolor": "white",
        "label": "Dead end (no turnaround)",
    },
    "track end": {"marker": "o", "s": 18, "color": "#999999", "label": "End of track"},
    "turnaround": {
        "marker": "o",
        "s": 60,
        "facecolor": "white",
        "edgecolor": "#333333",
        "linewidth": 1.5,
        "label": "Turnaround",
    },
    "gate": {
        "marker": "s",
        "s": 60,
        "color": "#f5c400",
        "edgecolor": "#333333",
        "label": "Gate or barrier",
    },
    "continues": {
        "marker": ">",
        "s": 40,
        # in the legend -- on the map, each is the color of its road
        "color": "#333333",
        "label": "Road continues",
    },
}
# house numbers go over everything else, with a white outline so they're readable over roads and symbols
HOUSE_NUMBER_STYLE = {
    "zorder": 6,
    "path_effects": [patheffects.withStroke(linewidth=2, foreground="white")],
}
SCALE_BAR_FEET = [100, 250, 500, 1000, 2500, 5000]
ROAD_NAME_STYLE = {
    "fontweight": "bold",
    # over the symbols, since one may end up over one when there's no other room
    "zorder": 6,
    # readable even where one is set beside its road, over another
    "path_effects": [patheffects.withStroke(linewidth=2, foreground="white")],
}
# how far a house number's middle is from its road's line, in points: half a main road's width, plus half the text's height
HOUSE_NUMBER_GAP = MAJOR_WIDTH / 2 + 4
# roughly how wide a character of the labels is, in points, for deciding whether a label fits along its road
CHAR_POINTS = {7.5: 4.8}


def upright(degrees: float) -> float:
    """Keeps text along a line from reading upside down."""
    return (degrees + 90) % 180 - 90


def arc(p0: np.ndarray, p1: np.ndarray, length: float, side: int = 1) -> np.ndarray:
    """Points from p0 to p1: a straight line if that's about the right length, otherwise a circular arc `length` long, bowed to `side` (1 or -1)."""
    chord = np.linalg.norm(p1 - p0)
    if length <= chord * 1.05:
        return np.array([p0, p1])
    # the angle the arc sweeps: length / chord = (angle / 2) / sin(angle / 2)
    sweep = brentq(
        lambda a: a / 2 / math.sin(a / 2) - length / chord, 1e-6, 2 * math.pi - 1e-6
    )
    radius = chord / 2 / math.sin(sweep / 2)
    mid = (p0 + p1) / 2
    normal = np.array([-(p1 - p0)[1], (p1 - p0)[0]]) / chord
    center = mid - side * normal * radius * math.cos(sweep / 2)
    start = math.atan2(*(p0 - center)[::-1])
    angles = start - side * sweep * np.linspace(0, 1, 50)
    return center + radius * np.column_stack([np.cos(angles), np.sin(angles)])


def loop(
    p: np.ndarray, length: float, away: np.ndarray, clockwise: bool = False
) -> np.ndarray:
    """A circle `length` around that starts and ends at p, on the side facing `away`, going around `clockwise` or not."""
    radius = length / (2 * math.pi)
    center = p + away / np.linalg.norm(away) * radius
    start = math.atan2(*(p - center)[::-1])
    angles = start + (-1 if clockwise else 1) * np.linspace(0, 2 * math.pi, 50)
    return center + radius * np.column_stack([np.cos(angles), np.sin(angles)])


def along(points: np.ndarray, fraction: float) -> tuple[np.ndarray, float]:
    """The point `fraction` of the way along a polyline, and its direction in degrees there."""
    steps = np.hypot(*np.diff(points, axis=0).T)
    target = fraction * steps.sum()
    k = min(np.searchsorted(np.cumsum(steps), target), len(steps) - 1)
    t = (target - steps[:k].sum()) / steps[k]
    dx, dy = points[k + 1] - points[k]
    return points[k] + t * (points[k + 1] - points[k]), math.degrees(math.atan2(dy, dx))


def node_kind(G: nx.MultiGraph, node, center: Point, radius_meters: float) -> str:
    """Which of NODE_STYLES a node is drawn as, or "name change" (not drawn) where one road just turns into another. Nodes past `radius_meters` from `center` are where roads leave the area."""
    data = G.nodes[node]
    if "barrier" in data:
        return "gate"
    if center.distance(Point(data["x"], data["y"])) > radius_meters:
        return "continues"
    if G.degree(node) == 1:
        if data.get("highway") in TURNAROUNDS:
            return "turnaround"
        ((_, _, road),) = G.edges(node, data=True)
        # like the detailed firefighter map, tracks aren't flagged, since they routinely end at trails
        return "track end" if road["highway"] == "track" else "dead end"
    if (
        G.degree(node) == 2
        and len({d["name"] for _, _, d in G.edges(node, data=True)}) == 2
    ):
        return "name change"
    return "intersection"


def outward_angle(node_pos: np.ndarray, node_paths: list) -> float:
    """The direction, in degrees, that roads head as they reach a node at the end of `node_paths` (each starting or ending there) -- for pointing where a road leaves the area."""
    directions = []
    for points in node_paths:
        # from the second point in to the node, at whichever end the node is
        end, inside = (
            (points[0], points[1])
            if np.allclose(points[0], node_pos)
            else (points[-1], points[-2])
        )
        direction = end - inside
        directions.append(direction / np.linalg.norm(direction))
    dx, dy = np.mean(directions, axis=0)
    return math.degrees(math.atan2(dy, dx))


def exits(points: np.ndarray, bounds: tuple) -> list[tuple[np.ndarray, float]]:
    """Where a path crosses the edge of `bounds` (xmin, ymin, xmax, ymax), and the direction in degrees it's heading out there, for each time it does -- including both ends of a stretch that cuts across the view with neither end in it."""
    view = box(*bounds)
    inside = [view.covers(Point(p)) for p in points]
    crossings = []
    for a, b, a_inside, b_inside in zip(points, points[1:], inside, inside[1:]):
        if a_inside and b_inside:
            continue
        hits = LineString([a, b]).intersection(view.boundary)
        # in order from a
        hits = sorted(
            (
                np.array(p.coords[0])
                for p in getattr(hits, "geoms", [hits])
                if not p.is_empty
            ),
            key=lambda p: np.linalg.norm(p - a),
        )
        if not a_inside and not b_inside and len(hits) != 2:
            # misses the view, or just touches a corner of it
            continue
        for i, hit in enumerate(hits):
            # heading out toward whichever end is outside on that side
            direction = a - b if i == 0 and not a_inside else b - a
            crossings.append(
                (hit, math.degrees(math.atan2(direction[1], direction[0])))
            )
    return crossings


def road_paths(G: nx.MultiGraph, pos: dict) -> dict:
    """Each edge's path on the page, running from its `from` node: straight between its ends where that's the right length, otherwise an arc (or, for a loop, a circle) of it."""
    paths = {}
    parallels = {}
    for u, v, k, data in G.edges(keys=True, data=True):
        a, b = data["from"], v if data["from"] == u else u
        if a == b:
            neighbors = [pos[n] for n in G.neighbors(a) if n != a]
            away = (
                pos[a] - np.mean(neighbors, axis=0) if neighbors else np.array([0, 1])
            )
            # the same way around as the actual road, so its left and right sides (where its houses are) stay put
            clockwise = not LinearRing(data["geometry"].coords).is_ccw
            paths[u, v, k] = loop(pos[a], data["length"], away, clockwise)
        else:
            # roads between the same two intersections bow out to alternating sides
            pair = tuple(sorted((a, b)))
            side = 1 if parallels.get(pair, 0) % 2 == 0 else -1
            parallels[pair] = parallels.get(pair, 0) + 1
            paths[u, v, k] = arc(
                pos[a], pos[b], data["length"], side if a == pair[0] else -side
            )
    return paths


class Diagram:
    """Draws a road network laid out by layout.layout(), on US Letter landscape pages for printing. Edges need the `from`, `grade`, `turns`, and `addresses` set by the other modules."""

    def __init__(
        self,
        G: nx.MultiGraph,
        pos: dict,
        center: Point,
        radius_meters: float,
        grade_limits: tuple[float, float],
        note: str,
    ):
        # `grade_limits` are the grades where roads turn from the first to second color, and second to third. `note` goes at the bottom of the legend.
        self.G = G
        self.pos = pos
        self.paths = road_paths(G, pos)
        self.kinds = {n: node_kind(G, n, center, radius_meters) for n in G.nodes}
        self.outward = {
            n: outward_angle(
                pos[n],
                [points for (u, v, _), points in self.paths.items() if n in (u, v)],
            )
            for n, kind in self.kinds.items()
            if kind == "continues"
        }
        low, high = grade_limits
        self.grade_colors = list(
            zip(
                [low, high, math.inf],
                GRADE_COLORS,
                [f"under {low:.0%}", f"{low:.0%}-{high:.0%}", f"over {high:.0%}"],
            )
        )
        self.note = note

    def grade_color(self, grade: float) -> str:
        return next(color for limit, color, _ in self.grade_colors if grade < limit)

    def legend(self) -> list:
        return (
            [
                Line2D([], [], color=color, linewidth=2.5, label=f"Steepest {label}")
                for _, color, label in self.grade_colors
            ]
            + [
                Line2D(
                    [], [], color="#333333", linewidth=MAJOR_WIDTH, label="Main road"
                ),
                Line2D([], [], color="#333333", linewidth=2.2, label="Local road"),
                Line2D(
                    [],
                    [],
                    color="#333333",
                    linewidth=1.6,
                    label="Driveway or service road",
                ),
                Line2D(
                    [],
                    [],
                    color="#333333",
                    linewidth=1.6,
                    linestyle=(0, (4, 2)),
                    label="Track",
                ),
                Line2D(
                    [],
                    [],
                    marker=TURN_MARKER,
                    markersize=10,
                    color="black",
                    linestyle="",
                    label="Sharp turn",
                ),
            ]
            + [
                Line2D(
                    [],
                    [],
                    marker=s["marker"],
                    linestyle="",
                    markersize=7,
                    markerfacecolor=s.get("facecolor", s.get("color")),
                    markeredgecolor=s.get("edgecolor", s.get("color")),
                    label=s["label"],
                )
                for s in NODE_STYLES.values()
            ]
        )

    def draw(self, title: str, bounds=None):
        """One page, with the legend in its own column. Afterward, `unlabeled` lists any road names on the page that there wasn't room for. `bounds` is (xmin, ymin, xmax, ymax) in layout coordinates, or the whole network if None."""
        G, pos, paths = self.G, self.pos, self.paths
        fig, (ax, key) = plt.subplots(1, 2, figsize=(11, 8.5), width_ratios=[5, 1])
        # fills the page, showing extra around the network rather than shrinking to fit it exactly
        ax.set_aspect("equal", adjustable="datalim")
        ax.set_axis_off()
        ax.set_title(title, loc="left", fontsize=13, fontweight="bold")

        for (u, v, k), points in paths.items():
            data = G.edges[u, v, k]
            ax.plot(
                *points.T,
                color=self.grade_color(data["grade"]),
                linewidth=WIDTHS.get(data["highway"], MAJOR_WIDTH),
                linestyle=(0, (4, 2)) if data["highway"] == "track" else "-",
                solid_capstyle="round",
                zorder=1,
            )
            for fraction in data["turns"]:
                (x, y), _ = along(points, fraction)
                ax.scatter(x, y, marker=TURN_MARKER, s=90, color="black", zorder=4)
        for kind, style in NODE_STYLES.items():
            shown = [n for n, k in self.kinds.items() if k == kind]
            if kind == "continues":
                # each pointing the way its road leaves the area, in its color (the steepest one's, if several leave together)
                for n in shown:
                    marker = MarkerStyle(
                        style["marker"],
                        transform=Affine2D().rotate_deg(self.outward[n]),
                    )
                    grade = max(data["grade"] for _, _, data in G.edges(n, data=True))
                    ax.scatter(
                        *pos[n],
                        zorder=5,
                        **{
                            **style,
                            "marker": marker,
                            "color": self.grade_color(grade),
                        },
                    )
            elif shown:
                ax.scatter(*np.array([pos[n] for n in shown]).T, zorder=5, **style)

        fig.tight_layout()
        if bounds is not None:
            # widened to the shape of the space on the page, so it's filled
            xmin, ymin, xmax, ymax = bounds
            space = ax.get_window_extent()
            page_ratio = space.height / space.width
            if (ymax - ymin) / (xmax - xmin) < page_ratio:
                pad = ((xmax - xmin) * page_ratio - (ymax - ymin)) / 2
                ymin, ymax = ymin - pad, ymax + pad
            else:
                pad = ((ymax - ymin) / page_ratio - (xmax - xmin)) / 2
                xmin, xmax = xmin - pad, xmax + pad
            ax.set_adjustable("box")
            ax.set_xlim(xmin, xmax)
            ax.set_ylim(ymin, ymax)
        # so the transform below reflects the final limits
        fig.canvas.draw()
        points_per_meter = (
            (ax.transData.transform((1, 0))[0] - ax.transData.transform((0, 0))[0])
            * 72
            / fig.dpi
        )
        if bounds is not None:
            # where roads run off the page, the same as where they leave the area -- just inside the edge, so the whole arrow shows
            style = NODE_STYLES["continues"]
            inset = 5 / points_per_meter
            (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
            for (u, v, k), points in paths.items():
                color = self.grade_color(G.edges[u, v, k]["grade"])
                for crossing, angle in exits(points, (x0, y0, x1, y1)):
                    radians = math.radians(angle)
                    marker = MarkerStyle(
                        style["marker"], transform=Affine2D().rotate_deg(angle)
                    )
                    ax.scatter(
                        *(
                            crossing
                            - inset * np.array([math.cos(radians), math.sin(radians)])
                        ),
                        zorder=5,
                        **{**style, "marker": marker, "color": color},
                    )
        # the space each label takes up, so later ones don't land on top of it -- starting with the title
        taken = [ax.title.get_window_extent()]
        # the symbols (intersections, dead ends, etc.), which labels stay off of where they can
        symbols_taken = []
        for symbols in ax.collections:
            sizes = symbols.get_sizes()
            for i, (x, y) in enumerate(ax.transData.transform(symbols.get_offsets())):
                # a marker's size is its area in points
                half = math.sqrt(sizes[i % len(sizes)]) / 2 * fig.dpi / 72
                symbols_taken.append(
                    Bbox.from_extents(x - half, y - half, x + half, y + half)
                )
        # switched off as a last resort for road names, which matter more than a symbol showing in full
        rules = {"avoid_symbols": True}
        # labels have to fit entirely on the map, rather than running off its edges or into the title
        map_area = ax.get_window_extent()

        def place(xy, text, fontsize, angle, offset, ha, va, style):
            """Adds a label at `xy`, `offset` points away, if it fits on the map clear of the other labels."""
            annotation = ax.annotate(
                text,
                xy,
                xytext=offset,
                textcoords="offset points",
                rotation=angle,
                rotation_mode="anchor",
                ha=ha,
                va=va,
                fontsize=fontsize,
                annotation_clip=True,
                **{"zorder": 3, **style},
            )
            extent = annotation.get_window_extent()
            if (
                not map_area.contains(extent.x0, extent.y0)
                or not map_area.contains(extent.x1, extent.y1)
                or any(extent.overlaps(other) for other in taken)
                or (
                    rules["avoid_symbols"]
                    and any(extent.overlaps(other) for other in symbols_taken)
                )
            ):
                annotation.remove()
                return False
            taken.append(extent)
            return True

        def along_road(points, text, fontsize, side, fraction, style):
            """Along the road at `fraction` of the way, just above (side=1) or below (side=-1) it."""
            xy, angle = along(points, fraction)
            angle = upright(angle)
            # clear of the line, rather than covering it
            gap = side * (MAJOR_WIDTH / 2 + 1)
            offset = (
                -gap * math.sin(math.radians(angle)),
                gap * math.cos(math.radians(angle)),
            )
            return place(
                xy,
                text,
                fontsize,
                angle,
                offset,
                "center",
                "bottom" if side > 0 else "top",
                style,
            )

        def beside_road(points, text, fontsize, fraction, style):
            """Level, next to the road at `fraction` of the way, on whichever side there's room -- for roads too short or crowded to label along."""
            xy, _ = along(points, fraction)
            gap = MAJOR_WIDTH / 2 + 2
            for offset, ha, va in (
                ((0, gap), "center", "bottom"),
                ((0, -gap), "center", "top"),
                ((gap, 0), "left", "center"),
                ((-gap, 0), "right", "center"),
                ((gap, gap), "left", "bottom"),
                ((-gap, gap), "right", "bottom"),
                ((gap, -gap), "left", "top"),
                ((-gap, -gap), "right", "top"),
            ):
                if place(xy, text, fontsize, 0, offset, ha, va, style):
                    return True
            return False

        def label_road(text, stretches, fontsize, style):
            """Labels a road once, made up of `stretches` (paths, longest first): along whichever stretch has room, trying several spots on either side, or failing that, level beside one -- clear of the symbols if possible, or over them if not. Returns whether it fit anywhere."""
            for avoid_symbols in (True, False):
                rules["avoid_symbols"] = avoid_symbols
                placed = try_label_road(text, stretches, fontsize, style)
                rules["avoid_symbols"] = True
                if placed:
                    return True
            return False

        def try_label_road(text, stretches, fontsize, style):
            for points in stretches:
                length = np.hypot(*np.diff(points, axis=0).T).sum() * points_per_meter
                if len(text) * CHAR_POINTS[fontsize] > length:
                    continue
                for fraction in (0.5, 0.35, 0.65, 0.2, 0.8):
                    for side in (-1, 1):
                        if along_road(points, text, fontsize, side, fraction, style):
                            return True
            for points in stretches:
                for fraction in (0.5, 0.25, 0.75):
                    if beside_road(points, text, fontsize, fraction, style):
                        return True
            return False

        # placed in order of importance, since a label that'd overlap an earlier one is left off: every road's name (or route number, if it has no name) once, then the house numbers
        stretches = {}
        for (u, v, k), points in paths.items():
            data = G.edges[u, v, k]
            text = data["name"] or data["ref"]
            if text:
                stretches.setdefault(text, []).append((data["length"], points))
        # only the roads that show on this page need labels
        (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
        view = box(x0, y0, x1, y1)
        self.unlabeled = []
        for text, roads in stretches.items():
            shown = [
                points
                for _, points in sorted(roads, key=lambda road: -road[0])
                if view.intersects(LineString(points))
            ]
            if shown and not label_road(text, shown, 7.5, ROAD_NAME_STYLE):
                self.unlabeled.append(text)
        for (u, v, k), points in paths.items():
            for fraction, number, offset in G.edges[u, v, k]["addresses"]:
                xy, angle = along(points, fraction)
                # on the side of the road the house is
                gap = math.copysign(HOUSE_NUMBER_GAP, offset)
                radians = math.radians(angle)
                place(
                    xy,
                    number,
                    7,
                    upright(angle),
                    (-gap * math.sin(radians), gap * math.cos(radians)),
                    "center",
                    "center",
                    HOUSE_NUMBER_STYLE,
                )

        # the longest round length that takes up no more than a sixth of the page
        width = np.diff(ax.get_xlim())[0] * FEET_PER_METER
        scale_feet = max(f for f in SCALE_BAR_FEET if f <= width / 6)
        ax.add_artist(
            AnchoredSizeBar(
                ax.transData,
                scale_feet / FEET_PER_METER,
                f"{scale_feet:,} ft of road",
                "lower right",
                frameon=False,
                size_vertical=0.05 * 72 / points_per_meter,
                fontproperties={"size": 7},
            )
        )
        key.set_axis_off()
        key.legend(handles=self.legend(), loc="upper left", fontsize=7.5, frameon=False)
        key.text(
            0,
            0,
            self.note,
            fontsize=6.5,
            color="#555555",
            va="bottom",
            wrap=True,
            transform=key.transAxes,
        )
        return fig
