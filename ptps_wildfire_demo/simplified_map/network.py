import networkx as nx
import osmnx as ox
from shapely import LineString
from shapely.ops import linemerge

# the same highway types as DRIVABLE_HIGHWAYS in the detailed firefighter map, minus parking lot aisles and drive-throughs
# https://wiki.openstreetmap.org/wiki/Key:highway
DRIVABLE_FILTER = (
    '["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track)$"]'
    '["service"!~"^(parking_aisle|parking|drive-through)$"]'
    '["area"!="yes"]'
)
# barriers an engine can't drive through, even when open some of the time -- also the same as the detailed firefighter map's
# https://wiki.openstreetmap.org/wiki/Key:barrier
VEHICLE_BARRIERS = {"gate", "lift_gate", "swing_gate", "chain", "bollard"}
# mapped places to turn around at the end of a road
# https://wiki.openstreetmap.org/wiki/Tag:highway%3Dturning_circle
TURNAROUNDS = {"turning_circle", "turning_loop"}
# the way tags kept on each edge, as a single value
EDGE_TAGS = ("name", "highway", "service", "ref")


def fetch_roads(center: tuple[float, float], radius_meters: float) -> nx.MultiGraph:
    """The drivable roads within `radius_meters` of `center` (lat, lon), projected to meters, with only intersections, dead ends, gates, and places where a road's name changes as nodes."""
    ox.settings.useful_tags_node = ["highway", "barrier"]
    ox.settings.useful_tags_way = [*EDGE_TAGS, "surface"]
    raw = ox.graph_from_point(
        center,
        dist=radius_meters,
        custom_filter=DRIVABLE_FILTER,
        simplify=False,
        # keeps roads that leave the area running to the next intersection, rather than stopping at the edge
        truncate_by_edge=True,
    )
    # only vehicle barriers should survive simplification as nodes of their own
    for _, data in raw.nodes(data=True):
        if data.get("barrier") not in VEHICLE_BARRIERS:
            data.pop("barrier", None)
    # split where a road's name changes too, so each edge has one name, for labeling and for placing addresses on
    G = ox.simplify_graph(
        raw, node_attrs_include=["barrier"], edge_attrs_differ=["name"]
    )
    # which roads connect matters here, not which way they're drawn -- one-way roads are rare out here
    return ox.convert.to_undirected(ox.project_graph(G))


def edge_line(G: nx.MultiGraph, u, v, data: dict) -> LineString:
    """The edge's geometry, running from u to v."""
    line = data.get("geometry") or LineString(
        [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in (u, v)]
    )
    start = line.coords[0]
    if (start[0], start[1]) != (G.nodes[u]["x"], G.nodes[u]["y"]):
        line = line.reverse()
    return line


def first(value):
    """OSMnx keeps a list (in no particular order) when the ways it merged disagree, so this picks one of them consistently."""
    return min(value) if isinstance(value, list) else value


def merge_through_nodes(G: nx.MultiGraph):
    """Joins the two edges at every node that's only between two roads, unless it's a gate or where the road's name changes."""
    for node in list(G.nodes):
        if G.degree(node) != 2 or "barrier" in G.nodes[node]:
            continue
        (_, a, _ka, da), (_, b, _kb, db) = G.edges(node, keys=True, data=True)
        if a == node or b == node or a == b:  # a loop
            continue
        if first(da.get("name")) != first(db.get("name")):
            continue
        line = linemerge([edge_line(G, a, node, da), edge_line(G, node, b, db)])
        merged = {
            **da,
            "geometry": line,
            "length": da["length"] + db["length"],
            # where the pieces' tags differ, the longer piece's win, e.g. a road that turns into a driveway
            **{
                k: first(max((da, db), key=lambda d: d["length"]).get(k))
                for k in EDGE_TAGS
            },
        }
        G.remove_node(node)
        G.add_edge(a, b, **merged)


def drop_short_driveways(G: nx.MultiGraph, min_meters: float):
    """Removes driveways shorter than `min_meters` that dead-end, then merges the roads they came off of back together."""
    G.remove_edges_from(
        [
            (u, v, k)
            for u, v, k, data in G.edges(keys=True, data=True)
            if data.get("service") == "driveway"
            and data["length"] < min_meters
            and min(G.degree(u), G.degree(v)) == 1
        ]
    )
    G.remove_nodes_from([n for n in list(G.nodes) if G.degree(n) == 0])
    merge_through_nodes(G)
    for _, _, data in G.edges(data=True):
        for k in EDGE_TAGS:
            data[k] = first(data.get(k))
