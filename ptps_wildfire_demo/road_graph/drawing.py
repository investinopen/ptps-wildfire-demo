import math

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
from matplotlib.lines import Line2D
from mpl_toolkits.axes_grid1.anchored_artists import AnchoredSizeBar
from scipy.optimize import brentq
from shapely import Point

from ptps_wildfire_demo.road_graph.network import TURNAROUNDS

FEET_PER_METER = 3.28084
FEET_PER_MILE = 5280

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
        "color": "#999999",
        "label": "Road continues",
    },
}
ADDRESS_STYLE = {
    "marker": "o",
    "s": 10,
    "facecolor": "white",
    "edgecolor": "#333333",
    "linewidth": 0.8,
}
SCALE_BAR_FEET = [100, 250, 500, 1000, 2500, 5000]
# roughly how wide a character of the labels is, in points, for deciding whether a label fits along its road
CHAR_POINTS = {5.5: 3.3, 6: 3.6, 7.5: 4.8}


def format_distance(meters: float) -> str:
    feet = meters * FEET_PER_METER
    if feet < 1000:
        return f"{round(feet, -1):.0f} ft"
    return f"{feet / FEET_PER_MILE:.1f} mi"


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


def loop(p: np.ndarray, length: float, away: np.ndarray) -> np.ndarray:
    """A circle `length` around that starts and ends at p, on the side facing `away`."""
    radius = length / (2 * math.pi)
    center = p + away / np.linalg.norm(away) * radius
    start = math.atan2(*(p - center)[::-1])
    angles = start + np.linspace(0, 2 * math.pi, 50)
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
        # like the firefighter map, tracks aren't flagged, since they routinely end at trails
        return "track end" if road["highway"] == "track" else "dead end"
    if (
        G.degree(node) == 2
        and len({d["name"] for _, _, d in G.edges(node, data=True)}) == 2
    ):
        return "name change"
    return "intersection"


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
            paths[u, v, k] = loop(pos[a], data["length"], away)
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
                for s in [
                    *NODE_STYLES.values(),
                    {**ADDRESS_STYLE, "label": "Address"},
                ]
            ]
        )

    def draw(self, title: str, bounds=None):
        """One page, with the legend in its own column. `bounds` is (xmin, ymin, xmax, ymax) in layout coordinates, or the whole network if None."""
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
            for fraction, _ in data["addresses"]:
                (x, y), _ = along(points, fraction)
                ax.scatter(x, y, zorder=4, **ADDRESS_STYLE)
        for kind, style in NODE_STYLES.items():
            shown = [pos[n] for n, k in self.kinds.items() if k == kind]
            if shown:
                ax.scatter(*np.array(shown).T, zorder=5, **style)

        fig.tight_layout()
        if bounds is not None:
            # widened to the shape of the space on the page, so it's filled
            xmin, ymin, xmax, ymax = bounds
            box = ax.get_window_extent()
            page_ratio = box.height / box.width
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
        renderer = fig.canvas.get_renderer()
        # the space each label takes up, so later ones don't land on top of it -- starting with the title
        taken = [ax.title.get_window_extent(renderer)]
        # labels have to fit entirely on the map, rather than running off its edges or into the title
        map_area = ax.get_window_extent(renderer)

        def place(points, text, fontsize, side, fraction):
            (x, y), angle = along(points, fraction)
            angle = upright(angle)
            # clear of the line, rather than covering it
            offset = side * (MAJOR_WIDTH / 2 + 1)
            annotation = ax.annotate(
                text,
                (x, y),
                xytext=(
                    -offset * math.sin(math.radians(angle)),
                    offset * math.cos(math.radians(angle)),
                ),
                textcoords="offset points",
                rotation=angle,
                rotation_mode="anchor",
                ha="center",
                va="bottom" if side > 0 else "top",
                fontsize=fontsize,
                zorder=3,
                annotation_clip=True,
                fontweight="bold" if fontsize > 6 else "normal",
            )
            extent = annotation.get_window_extent(renderer)
            if (
                not map_area.contains(extent.x0, extent.y0)
                or not map_area.contains(extent.x1, extent.y1)
                or any(extent.overlaps(other) for other in taken)
            ):
                annotation.remove()
                return False
            taken.append(extent)
            return True

        def label(points, text, fontsize, side, fractions=(0.5, 0.3, 0.7), fits=None):
            """Along the road, just above (side=1) or below (side=-1) it -- if the road's long enough to fit it (or `fits` says so) -- at the first of `fractions` of the way along where it's clear of the other labels."""
            length = np.hypot(*np.diff(points, axis=0).T).sum() * points_per_meter
            if fits is None:
                fits = len(text) * CHAR_POINTS[fontsize] <= length
            if not fits:
                return
            for fraction in fractions:
                if place(points, text, fontsize, side, fraction):
                    return

        # placed in order of importance, since a label that'd overlap an earlier one is left off: each road's name once, below its longest stretch, then the distances, then the house numbers
        longest = {}
        for (u, v, k), points in paths.items():
            data = G.edges[u, v, k]
            if data["name"] and data["length"] > longest.get(data["name"], (0,))[0]:
                longest[data["name"]] = (data["length"], points)
        for name, (_, points) in longest.items():
            label(points, name, 7.5, -1)
        for (u, v, k), points in paths.items():
            label(points, format_distance(G.edges[u, v, k]["length"]), 6, 1)
        for (u, v, k), points in paths.items():
            for fraction, number in G.edges[u, v, k]["addresses"]:
                label(points, number, 5.5, -1, [fraction], fits=True)

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
