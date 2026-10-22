import json
from pathlib import Path

import numpy as np
import pytest

from ptps_wildfire_demo.access_tiles import (
    extract,
    format_weight,
    length_meters,
    osmium_filters,
    use_counts,
)

# nodes about 111 m apart, along the equator and up from it
A, B, C, D = (0, 0), (0.001, 0), (0.002, 0), (0.001, 0.001)


def osm_file(tmp_path: Path, nodes: dict, ways: list) -> Path:
    """An .osm file of `nodes` ({id: ((lon, lat), {tags})}) and `ways` ([(id, [node ids], {tags})])."""

    def tag_xml(tags: dict) -> str:
        return "".join(f'<tag k="{k}" v="{v}"/>' for k, v in tags.items())

    lines = ['<?xml version="1.0"?>', '<osm version="0.6">']
    for id, ((lon, lat), tags) in sorted(nodes.items()):
        lines.append(
            f'<node id="{id}" version="1" lat="{lat}" lon="{lon}">{tag_xml(tags)}</node>'
        )
    for id, refs, tags in ways:
        nds = "".join(f'<nd ref="{ref}"/>' for ref in refs)
        lines.append(f'<way id="{id}" version="1">{nds}{tag_xml(tags)}</way>')
    lines.append("</osm>")
    path = tmp_path / "test.osm"
    path.write_text("\n".join(lines))
    return path


def layers(tmp_path: Path, nodes: dict, ways: list) -> dict[str, list[dict]]:
    """Each layer's features, extracted from `nodes` and `ways` (see osm_file())."""
    out = tmp_path / "out"
    extract(osm_file(tmp_path, nodes, ways), out)
    return {
        path.stem: [json.loads(line) for line in path.read_text().splitlines()]
        for path in out.glob("*.geojsonl")
    }


def coords(features: list[dict]) -> list:
    return sorted(tuple(f["geometry"]["coordinates"]) for f in features)


def plain_nodes(**tags_by_id) -> dict:
    """Nodes 1-4 at A-D, with any tags given as n1={...} etc."""
    return {
        i: (point, tags_by_id.get(f"n{i}", {}))
        for i, point in enumerate((A, B, C, D), 1)
    }


@pytest.fixture
def roads(tmp_path: Path):
    def build(ways: list, **node_tags) -> dict[str, list[dict]]:
        return layers(tmp_path, plain_nodes(**node_tags), ways)

    return build


def test_flags_the_free_ends_of_roads_not_where_they_join(roads):
    # 1-2-3 is a through road; 2-4 branches off it and stops at 4
    found = roads(
        [
            (10, [1, 2, 3], {"highway": "residential"}),
            (11, [2, 4], {"highway": "residential"}),
        ]
    )
    assert coords(found["dead-ends"]) == sorted([A, C, D])


def test_skips_an_end_with_a_turning_circle(roads):
    found = roads(
        [(10, [1, 2, 3], {"highway": "residential"})], n3={"highway": "turning_circle"}
    )
    assert coords(found["dead-ends"]) == [A]


def test_skips_a_closed_loop(roads):
    found = roads([(10, [1, 2, 4, 1], {"highway": "residential"})])
    assert found["dead-ends"] == []


@pytest.mark.parametrize(
    "tags",
    [
        {"highway": "track"},
        {"highway": "service", "service": "parking_aisle"},
        # about 111 m
        {"highway": "service", "service": "driveway"},
    ],
)
def test_skips_tracks_parking_aisles_and_short_driveways(roads, tags: dict):
    assert roads([(10, [1, 2], tags)])["dead-ends"] == []


def test_flags_a_long_driveway(roads):
    # about 222 m
    found = roads([(10, [1, 2, 3], {"highway": "service", "service": "driveway"})])
    assert len(found["dead-ends"]) == 2


def test_ignores_paths(roads):
    found = roads([(10, [1, 2], {"highway": "footway", "oneway": "yes"})])
    assert all(features == [] for features in found.values())


def test_road_access_layers(roads):
    found = roads(
        [
            (10, [1, 2], {"highway": "residential", "oneway": "yes"}),
            (11, [2, 3], {"highway": "residential", "oneway": "-1"}),
            (
                12,
                [2, 4],
                {"highway": "residential", "bridge": "yes", "maxweight": "10"},
            ),
        ],
        n2={"barrier": "gate"},
        # not a vehicle barrier
        n3={"barrier": "kissing_gate"},
    )
    assert [f["properties"]["oneway"] for f in found["oneway"]] == [1, -1]
    assert found["oneway"][0]["geometry"]["coordinates"] == [list(A), list(B)]
    assert coords(found["gates"]) == [B]
    assert [f["properties"]["label"] for f in found["weight-limits"]] == ["11 tons"]


def test_only_counts_gates_on_roads(tmp_path: Path):
    found = layers(tmp_path, {1: (A, {"barrier": "gate"})}, [])
    assert found["gates"] == []


def test_water_sources(tmp_path: Path):
    nodes = {
        1: (A, {"emergency": "fire_hydrant"}),
        2: (B, {"emergency": "water_tank"}),
        3: (C, {"leisure": "swimming_pool", "indoor": "yes"}),
        # the corners of a pool mapped as an area
        5: ((0, 0.01), {}),
        6: ((0.002, 0.01), {}),
        7: ((0.002, 0.012), {}),
        8: ((0, 0.012), {}),
    }
    found = layers(
        tmp_path, nodes, [(20, [5, 6, 7, 8, 5], {"leisure": "swimming_pool"})]
    )
    kinds = {
        tuple(f["geometry"]["coordinates"]): f["properties"]["kind"]
        for f in found["water"]
    }
    assert kinds == {A: "hydrant", B: "water_source", (0.001, 0.011): "pool"}


def test_tags_features_with_their_min_zoom(roads):
    found = roads(
        [(10, [1, 2], {"highway": "residential"})], n1={"emergency": "fire_hydrant"}
    )
    assert found["water"][0]["tippecanoe"] == {"minzoom": 13}
    assert found["dead-ends"][0]["tippecanoe"] == {"minzoom": 14}


def test_use_counts():
    candidates = np.array([2, 5, 9])
    refs = np.array([1, 2, 5, 5, 7, 9, 10, 5])
    assert use_counts(candidates, refs, chunk=3).tolist() == [1, 3, 1]
    assert use_counts(np.array([], dtype=np.int64), refs).tolist() == []


def test_length_meters():
    assert length_meters([A, B]) == pytest.approx(111.2, abs=0.1)
    assert length_meters([A, B, C]) == pytest.approx(222.4, abs=0.1)


@pytest.mark.parametrize(
    ("maxweight", "expected"),
    [
        # short tons, as US bridges are usually tagged
        ("15 st", "15 tons"),
        ("3.5 st", "3.5 tons"),
        ("5 tons", "5 tons"),
        # metric tonnes (the default with no unit), rounded down
        ("10", "11 tons"),
        (" 5.5 ", "6 tons"),
        ("5t", "5.5 tons"),
        ("20000 lbs", "10 tons"),
        ("7000 lbs", "3.5 tons"),
        # left as tagged
        ("unknown", "unknown"),
        ("1.2.3 t", "1.2.3 t"),
    ],
)
def test_format_weight(maxweight: str, expected: str):
    assert format_weight(maxweight) == expected


def test_osmium_filters():
    filters = osmium_filters()
    assert "n/barrier=bollard,chain,gate,lift_gate,swing_gate" in filters
    assert "n/highway=turning_circle,turning_loop" in filters
    assert (
        "nwr/emergency=fire_hydrant,fire_water_pond,suction_point,water_tank" in filters
    )
    assert "nwr/leisure=swimming_pool" in filters
    (roads,) = (f for f in filters if f.startswith("w/highway="))
    assert set(roads.removeprefix("w/highway=").split(",")) >= {
        "residential",
        "track",
        "motorway_link",
    }
