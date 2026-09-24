from collections.abc import Callable

import networkx as nx
import numpy as np
from shapely import LineString

from ptps_wildfire_demo.road_graph.network import edge_line


def sample(line: LineString, step_meters: float):
    """Distances along the line every `step_meters` (and at its end), and the x/y there."""
    distances = np.append(np.arange(0, line.length, step_meters), line.length)
    points = [line.interpolate(d) for d in distances]
    return distances, np.array([p.x for p in points]), np.array([p.y for p in points])


def max_grade(xs, ys, elevations, span_steps: int, span_meters: float) -> float:
    """The steepest climb over any `span_steps` samples (`span_meters`), or end to end if the road's shorter than that."""
    if len(elevations) <= span_steps:
        run = np.hypot(xs[-1] - xs[0], ys[-1] - ys[0])
        return abs(elevations[-1] - elevations[0]) / run if run else 0
    rise = np.abs(elevations[span_steps:] - elevations[:-span_steps])
    return rise.max() / span_meters


def sharp_turns(distances, xs, ys, min_degrees: float, span_steps: int) -> list[float]:
    """Distances along the line of the tightest point of each bend where the heading changes by at least `min_degrees` from `span_steps` samples before to `span_steps` after."""
    n = len(xs)
    if n <= 2 * span_steps:
        return []
    i = np.arange(span_steps, n - span_steps)
    before = np.arctan2(ys[i] - ys[i - span_steps], xs[i] - xs[i - span_steps])
    after = np.arctan2(ys[i + span_steps] - ys[i], xs[i + span_steps] - xs[i])
    turn = np.degrees(np.abs((after - before + np.pi) % (2 * np.pi) - np.pi))
    turns = []
    # walk each run of sharp samples, and keep its sharpest
    sharp = turn >= min_degrees
    start = None
    for k in range(len(turn) + 1):
        if k < len(turn) and sharp[k]:
            start = k if start is None else start
        elif start is not None:
            best = start + int(np.argmax(turn[start:k]))
            turns.append(float(distances[i[best]]))
            start = None
    return turns


def add_profiles(
    G: nx.MultiGraph,
    elevation: Callable,
    step_meters: float,
    grade_span_meters: float,
    turn_degrees: float,
    turn_span_meters: float,
):
    """Sets each edge's `grade` (steepest) and `turns` (sharp ones, as fractions of the way along), with its `geometry` running from its `from` node."""
    grade_steps = int(grade_span_meters // step_meters)
    turn_steps = int(turn_span_meters // step_meters)
    for u, v, data in G.edges(data=True):
        line = edge_line(G, u, v, data)
        data["geometry"] = line
        data["from"] = u
        distances, xs, ys = sample(line, step_meters)
        data["grade"] = max_grade(
            xs, ys, elevation(xs, ys), grade_steps, grade_span_meters
        )
        # as a fraction of the way from u to v, for placing on the diagram
        data["turns"] = [
            d / line.length
            for d in sharp_turns(distances, xs, ys, turn_degrees, turn_steps)
        ]
