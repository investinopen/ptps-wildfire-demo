import networkx as nx
from shapely import LineString, Point


def place_address(G: nx.MultiGraph, point: Point, street) -> tuple[float, dict, bool]:
    """The road an address goes on, how far it is from it, and whether that's a driveway rather than its street.

    That's the closest road with its `street` name, or the closest road at all if there isn't one. A house down a driveway goes on the driveway instead, when the driveway is closer and comes off its street, since that's where it's reached from."""
    candidates = [
        (data["geometry"].distance(point), (u, v), data)
        for u, v, data in G.edges(data=True)
    ]
    on_street = [c for c in candidates if c[2]["name"] == street]
    distance, _, road = min(on_street or candidates, key=lambda c: c[0])
    nearest_distance, ends, nearest = min(candidates, key=lambda c: c[0])
    street_nodes = {n for _, (u, v), _ in on_street for n in (u, v)}
    if (
        nearest["highway"] == "service"
        and nearest_distance < distance
        and street_nodes.intersection(ends)
    ):
        return nearest_distance, nearest, True
    return distance, road, False


def offset_from(line: LineString, point: Point) -> tuple[float, float]:
    """How far along `line` the closest point to `point` is, as a fraction of its length, and how far `point` is from it -- positive to the left of the line's direction, negative to the right."""
    along = line.project(point)
    closest = line.interpolate(along)
    # the line's direction there, from a meter on either side
    behind = line.interpolate(max(along - 1, 0))
    ahead = line.interpolate(min(along + 1, line.length))
    cross = (ahead.x - behind.x) * (point.y - closest.y) - (ahead.y - behind.y) * (
        point.x - closest.x
    )
    distance = closest.distance(point)
    return along / line.length, distance if cross >= 0 else -distance


def place_addresses(G: nx.MultiGraph, addresses, max_meters: float) -> tuple[int, int]:
    """Adds each of `addresses` (a GeoDataFrame of points in the graph's CRS, with `addr:street` and `addr:housenumber`) to its road's `addresses`, as (fraction of the way from the road's `from` node, house number, distance from the road -- see offset_from()). Ones more than `max_meters` from their road are left off. Returns how many were placed, and how many of those on driveways."""
    for _, _, data in G.edges(data=True):
        data["addresses"] = []
    placed = on_driveways = 0
    for point, street, number in zip(
        addresses.geometry, addresses["addr:street"], addresses["addr:housenumber"]
    ):
        distance, road, on_driveway = place_address(G, point, street)
        if distance > max_meters:
            continue
        fraction, offset = offset_from(road["geometry"], point)
        road["addresses"].append((fraction, number, offset))
        placed += 1
        on_driveways += on_driveway
    return placed, on_driveways
