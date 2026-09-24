import math

import networkx as nx
import numpy as np
import pytest
from shapely import LineString, Point

from ptps_wildfire_demo.road_graph.addresses import place_address
from ptps_wildfire_demo.road_graph.drawing import (
    along,
    arc,
    loop,
    node_kind,
    upright,
)
from ptps_wildfire_demo.road_graph.elevation import decode_terrarium
from ptps_wildfire_demo.road_graph.layout import layout
from ptps_wildfire_demo.road_graph.links import (
    firefighter_map_url,
    openstreetmap_url,
    zoom_for,
)
from ptps_wildfire_demo.road_graph.network import (
    drop_short_driveways,
    edge_line,
    first,
)
from ptps_wildfire_demo.road_graph.profile import max_grade, sample, sharp_turns


def polyline_length(points):
    return np.hypot(*np.diff(points, axis=0).T).sum()


def road_network(nodes, edges):
    """A projected road network like the one fetch_roads() returns. `nodes` is {id: (x, y)}, and `edges` is [(u, v, {tags})], with straight-line geometry and length filled in when missing."""
    G = nx.MultiGraph()
    for n, (x, y) in nodes.items():
        G.add_node(n, x=x, y=y)
    for u, v, tags in edges:
        line = tags.pop("geometry", None) or LineString([nodes[u], nodes[v]])
        G.add_edge(
            u,
            v,
            geometry=line,
            length=line.length,
            **{"name": None, "highway": "residential", **tags},
        )
    return G


def test_first():
    assert first(["Main Street", "Hill Street"]) == "Hill Street"
    assert first(["Hill Street", "Main Street"]) == "Hill Street"
    assert first("Main Street") == "Main Street"
    assert first(None) is None


def test_edge_line_runs_from_u():
    G = road_network({1: (0, 0), 2: (10, 0)}, [(1, 2, {})])
    data = G.edges[1, 2, 0]
    assert edge_line(G, 1, 2, data).coords[0] == (0, 0)
    assert edge_line(G, 2, 1, data).coords[0] == (10, 0)


def test_drop_short_driveways():
    # a road from 1 to 3, with a short driveway at 2, and a long one and another road at 3
    G = road_network(
        {
            1: (0, 0),
            2: (100, 0),
            3: (200, 0),
            4: (100, 50),
            5: (200, 300),
            6: (300, 0),
        },
        [
            (1, 2, {"name": "Main Street"}),
            (2, 3, {"name": "Main Street"}),
            (2, 4, {"highway": "service", "service": "driveway"}),
            (3, 5, {"highway": "service", "service": "driveway"}),
            (3, 6, {"name": "Hill Street"}),
        ],
    )
    drop_short_driveways(G, min_meters=150)
    # the short driveway's gone, and the road it came off of is one edge again
    assert set(G.nodes) == {1, 3, 5, 6}
    assert G.number_of_edges(1, 3) == 1
    main = G.edges[1, 3, 0]
    assert main["length"] == pytest.approx(200)
    assert main["name"] == "Main Street"
    assert G.has_edge(3, 5)


def test_drop_short_driveways_keeps_gates():
    G = road_network(
        {1: (0, 0), 2: (100, 0), 3: (200, 0)},
        [(1, 2, {}), (2, 3, {})],
    )
    G.nodes[2]["barrier"] = "gate"
    drop_short_driveways(G, min_meters=150)
    assert set(G.nodes) == {1, 2, 3}


def test_drop_short_driveways_keeps_name_changes():
    G = road_network(
        {1: (0, 0), 2: (100, 0), 3: (200, 0)},
        [(1, 2, {"name": "Boulder Street"}), (2, 3, {"name": "Gold Run Road"})],
    )
    drop_short_driveways(G, min_meters=150)
    assert set(G.nodes) == {1, 2, 3}
    assert node_kind(G, 2, Point(0, 0), 500) == "name change"


def test_sample():
    distances, xs, _ = sample(LineString([(0, 0), (25, 0)]), step_meters=10)
    assert list(distances) == [0, 10, 20, 25]
    assert list(xs) == [0, 10, 20, 25]


def test_max_grade():
    xs = np.arange(0, 110, 10.0)
    ys = np.zeros_like(xs)
    # flat, then climbing 2 m every 10 m
    elevations = np.array([0, 0, 0, 0, 0, 0, 2, 4, 6, 8, 10.0])
    assert max_grade(xs, ys, elevations, span_steps=5, span_meters=50) == pytest.approx(
        0.2
    )


def test_max_grade_short_road():
    xs, ys = np.array([0, 10.0]), np.array([0, 0.0])
    assert max_grade(
        xs, ys, np.array([0, 1.0]), span_steps=5, span_meters=50
    ) == pytest.approx(0.1)


def test_sharp_turns():
    # a hairpin: 100 m east, then 100 m back west, 10 m north of the way out
    line = LineString([(0, 0), (100, 0), (100, 10), (0, 10)])
    distances, xs, ys = sample(line, step_meters=10)
    turns = sharp_turns(distances, xs, ys, min_degrees=110, span_steps=3)
    assert len(turns) == 1
    assert 90 <= turns[0] <= 120


def test_sharp_turns_straight_road():
    distances, xs, ys = sample(LineString([(0, 0), (500, 0)]), step_meters=10)
    assert sharp_turns(distances, xs, ys, min_degrees=110, span_steps=3) == []


def test_place_address_on_its_street():
    G = road_network(
        {1: (0, 0), 2: (200, 0), 3: (0, 100), 4: (200, 100)},
        [(1, 2, {"name": "Main Street"}), (3, 4, {"name": "Hill Street"})],
    )
    # closer to Hill Street, but on Main Street
    distance, road, on_driveway = place_address(G, Point(50, 70), "Main Street")
    assert road["name"] == "Main Street"
    assert distance == pytest.approx(70)
    assert not on_driveway


def test_place_address_on_driveway():
    G = road_network(
        {1: (0, 0), 2: (100, 0), 3: (200, 0), 4: (100, 300), 5: (300, 300)},
        [
            (1, 2, {"name": "Main Street"}),
            (2, 3, {"name": "Main Street"}),
            (2, 4, {"highway": "service"}),
            # someone else's driveway, off of another road
            (3, 5, {"highway": "service"}),
        ],
    )
    _, road, on_driveway = place_address(G, Point(110, 250), "Main Street")
    assert on_driveway
    assert road is G.edges[2, 4, 0]


def test_place_address_ignores_driveways_off_other_streets():
    G = road_network(
        {1: (0, 0), 2: (200, 0), 3: (0, 100), 4: (200, 100), 5: (100, 60)},
        [
            (1, 2, {"name": "Main Street"}),
            (3, 4, {"name": "Hill Street"}),
            (3, 5, {"highway": "service"}),
        ],
    )
    _, road, on_driveway = place_address(G, Point(100, 55), "Main Street")
    assert not on_driveway
    assert road["name"] == "Main Street"


def test_layout_scales_roads_by_driving_distance():
    # a square, where the north side is a winding road twice as long as it looks
    winding = LineString([(0, 100), (50, 150), (100, 100)])
    G = road_network(
        {1: (0, 0), 2: (100, 0), 3: (100, 100), 4: (0, 100)},
        [
            (1, 2, {}),
            (2, 3, {}),
            (3, 4, {"geometry": LineString([(100, 100), (50, 170), (0, 100)])}),
            (4, 1, {}),
        ],
    )
    assert winding.length < G.edges[3, 4, 0]["length"]
    result = layout(G, geography_weight=0.001, spacing_weight=0.001)
    assert result.length_error.max() < 0.05
    # still the right way up
    assert result.pos[4][1] > result.pos[1][1]
    assert result.north_south_flipped == 0


def test_arc_is_as_long_as_the_road():
    p0, p1 = np.array([0.0, 0]), np.array([100.0, 0])
    assert polyline_length(arc(p0, p1, 100)) == pytest.approx(100)
    points = arc(p0, p1, 150)
    assert polyline_length(points) == pytest.approx(150, rel=0.01)
    assert points[0] == pytest.approx(p0)
    assert points[-1] == pytest.approx(p1)
    # bows to opposite sides
    assert arc(p0, p1, 150, side=1)[25][1] * arc(p0, p1, 150, side=-1)[25][1] < 0


def test_loop():
    p = np.array([10.0, 10])
    points = loop(p, 2 * math.pi * 20, away=np.array([0, 1.0]))
    assert points[0] == pytest.approx(p)
    assert points[-1] == pytest.approx(p)
    assert polyline_length(points) == pytest.approx(2 * math.pi * 20, rel=0.01)
    assert points[:, 1].min() == pytest.approx(10)


def test_along():
    points = np.array([[0.0, 0], [100, 0], [100, 100]])
    (x, y), angle = along(points, 0.75)
    assert (x, y) == pytest.approx((100, 50))
    assert angle == pytest.approx(90)


@pytest.mark.parametrize(
    "degrees,expected", [(0, 0), (45, 45), (135, -45), (-135, 45), (90, -90)]
)
def test_upright(degrees, expected):
    assert upright(degrees) == pytest.approx(expected)


def test_node_kind():
    G = road_network(
        {1: (0, 0), 2: (100, 0), 3: (200, 0), 4: (100, 100), 5: (0, 1000)},
        [
            (1, 2, {}),
            (2, 3, {"highway": "track"}),
            (2, 4, {}),
            (1, 5, {}),
        ],
    )
    G.nodes[4]["highway"] = "turning_circle"
    kinds = {n: node_kind(G, n, Point(0, 0), 500) for n in G.nodes}
    assert kinds == {
        1: "intersection",
        2: "intersection",
        3: "track end",
        4: "turnaround",
        5: "continues",
    }
    del G.nodes[4]["highway"]
    assert node_kind(G, 4, Point(0, 0), 500) == "dead end"


def test_decode_terrarium():
    # 128 * 256 + 5 + 128 / 256 - 32768 = 5.5
    assert decode_terrarium(np.array([[[128, 5, 128]]]))[0, 0] == pytest.approx(5.5)


def test_zoom_for():
    # each zoom level in is half as far across
    assert zoom_for(40, 500) == pytest.approx(zoom_for(40, 1000) + 1)
    assert 15 < zoom_for(40.063, 1200) < 16


def test_firefighter_map_url():
    assert (
        firefighter_map_url((40.063, -105.409), 1200)
        == f"firefighter-map/#{zoom_for(40.063, 1200):.2f}/40.06300/-105.40900"
    )


def test_openstreetmap_url():
    assert (
        openstreetmap_url((40.063, -105.409), 1200)
        == "https://www.openstreetmap.org/#map=15/40.06300/-105.40900"
    )
