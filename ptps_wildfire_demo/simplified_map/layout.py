from dataclasses import dataclass

import networkx as nx
import numpy as np
from scipy.optimize import minimize


@dataclass
class Layout:
    # node -> (x, y) on the page, in meters
    pos: dict
    # for each pair of intersections joined by a road, how far off its length on the page is, as a fraction of its driving distance
    length_error: np.ndarray
    # of the pairs of intersections at least 100 m apart north-south / east-west, the fraction that ended up the other way around on the page
    north_south_flipped: float
    east_west_flipped: float


def shortest_roads(G: nx.MultiGraph) -> nx.Graph:
    """One edge per pair of connected intersections, for the shortest road between them. Loops are left out."""
    simple = nx.Graph()
    for u, v, data in G.edges(data=True):
        if u != v and (
            not simple.has_edge(u, v) or data["length"] < simple[u][v]["length"]
        ):
            simple.add_edge(u, v, length=data["length"])
    return simple


def fraction_flipped(before: np.ndarray, after: np.ndarray, min_apart: float) -> float:
    """Of the differences in `before` of at least `min_apart`, the fraction whose sign is different in `after`."""
    apart = np.abs(before) >= min_apart
    return float(np.mean(np.sign(before[apart]) != np.sign(after[apart])))


def layout(G: nx.MultiGraph, geography_weight: float, spacing_weight: float) -> Layout:
    """Places each node so that the shortest road between each pair of intersections is as long on the page as its driving distance, balanced against two weaker pulls: toward each node's actual location (`geography_weight`), and toward every pair of nodes being as far apart as the driving distance between them (`spacing_weight`). Both weights are relative to road lengths."""
    simple = shortest_roads(G)
    nodes = list(simple.nodes)
    index = {n: i for i, n in enumerate(nodes)}
    edge_i = np.array([index[u] for u, v in simple.edges])
    edge_j = np.array([index[v] for u, v in simple.edges])
    edge_length = np.array([d["length"] for _, _, d in simple.edges(data=True)])
    pair_i, pair_j = np.triu_indices(len(nodes), 1)
    pair_distance = nx.floyd_warshall_numpy(simple, nodelist=nodes, weight="length")[
        pair_i, pair_j
    ]
    geographic = np.array([(G.nodes[n]["x"], G.nodes[n]["y"]) for n in nodes])
    typical_length = np.median(edge_length)

    def stress(flat):
        """How far off each road's length (and, weakly, each node's location and each pair's spacing) is, relative to its target -- and its gradient."""
        X = flat.reshape(-1, 2)
        moved = (X - geographic) / typical_length
        total = geography_weight * (moved**2).sum()
        gradient = 2 * geography_weight * moved / typical_length
        for i, j, target, weight in (
            (edge_i, edge_j, edge_length, 1),
            (pair_i, pair_j, pair_distance, spacing_weight),
        ):
            delta = X[i] - X[j]
            actual = np.hypot(delta[:, 0], delta[:, 1]) + 1e-9
            error = (actual - target) / target
            total += weight * (error**2).sum()
            g = (2 * weight * error / target / actual)[:, None] * delta
            np.add.at(gradient, i, g)
            np.add.at(gradient, j, -g)
        return total, gradient.ravel()

    # starting from the actual locations
    result = minimize(stress, geographic.ravel(), jac=True, method="L-BFGS-B")
    X = result.x.reshape(-1, 2)
    drawn = np.hypot(*(X[edge_i] - X[edge_j]).T)
    flipped = [
        fraction_flipped(
            geographic[pair_i, axis] - geographic[pair_j, axis],
            X[pair_i, axis] - X[pair_j, axis],
            min_apart=100,
        )
        for axis in (1, 0)
    ]
    return Layout(
        pos=dict(zip(nodes, X)),
        length_error=np.abs(drawn / edge_length - 1),
        north_south_flipped=flipped[0],
        east_west_flipped=flipped[1],
    )
