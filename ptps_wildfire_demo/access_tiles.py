"""Builds the detailed firefighter map's water and road-access layers (water sources, gates, one-way streets, weight-limited bridges, dead ends) from an OpenStreetMap extract, as GeoJSONSeq files for tippecanoe to turn into PMTiles. Run by .github/workflows/build-access-tiles.yml -- see site/README.md for how the pieces fit together."""

import itertools
import json
import math
import re
import sys
from array import array
from collections import Counter
from collections.abc import Iterable
from contextlib import ExitStack
from pathlib import Path
from typing import Self, TextIO

import numpy as np
import osmium

# drivable roads -- tracks are included since engines use them as fire roads, but never flagged as dead ends (they routinely end at trails)
# https://wiki.openstreetmap.org/wiki/Key:highway
DRIVABLE_HIGHWAYS = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
    "service",
    "track",
}
# barriers an engine can't drive through, even when open some of the time
# https://wiki.openstreetmap.org/wiki/Key:barrier
VEHICLE_BARRIERS = {"gate", "lift_gate", "swing_gate", "chain", "bollard"}
# mapped places to turn around at the end of a road
# https://wiki.openstreetmap.org/wiki/Tag:highway%3Dturning_circle
TURNAROUNDS = {"turning_circle", "turning_loop"}
# service roads that end in a parking lot or drive-through by design
NON_ROUTE_SERVICE = {"parking_aisle", "parking", "drive-through"}
# short driveways can be backed out of; long rural ones with no turnaround are the real hazard for an engine
MIN_DEAD_END_DRIVEWAY_METERS = 150
# water sources an engine can draw from. Cisterns don't have their own tag -- OSM maps them as emergency=water_tank.
# https://wiki.openstreetmap.org/wiki/Key:emergency
WATER_SOURCES = {"water_tank", "suction_point", "fire_water_pond"}

# the zoom each layer starts at in the tiles: the same as its layers' minzoom in site/firefighter-maps/detailed/scripts/layers.js, except the road-access ones, which the map shows from 15 but are only built at 14 (the tiles' max zoom), which MapLibre stretches to draw at higher zooms
WATER_MIN_ZOOM = 13
ROAD_ACCESS_MIN_ZOOM = 14
LAYERS = {
    "water": WATER_MIN_ZOOM,
    "gates": ROAD_ACCESS_MIN_ZOOM,
    "oneway": ROAD_ACCESS_MIN_ZOOM,
    "weight-limits": ROAD_ACCESS_MIN_ZOOM,
    "dead-ends": ROAD_ACCESS_MIN_ZOOM,
}

# OSM's maxweight comes in several units -- metric tonnes when there's none, short tons ("st"), pounds ("lbs"), etc. -- so it's converted to US tons (2,000 lb), the unit on US bridge signs and engine specs.
# https://wiki.openstreetmap.org/wiki/Key:maxweight
POUNDS_PER_UNIT = {
    "": 2204.62,
    "t": 2204.62,
    "st": 2000,
    "ton": 2000,
    "tons": 2000,
    "lt": 2240,
    "lb": 1,
    "lbs": 1,
    "kg": 2.20462,
}
# decimal places coordinates are written with -- the 7 OSM stores, about a centimeter
PRECISION = 7

Coords = list[tuple[float, float]]


def osmium_filters() -> list[str]:
    """`osmium tags-filter` expressions for what extract() reads, so an extract can be filtered down to it first."""
    # https://docs.osmcode.org/osmium/latest/osmium-tags-filter.html
    expressions = {
        "w/highway": DRIVABLE_HIGHWAYS,
        "n/barrier": VEHICLE_BARRIERS,
        "n/highway": TURNAROUNDS,
        "nwr/emergency": {"fire_hydrant", *WATER_SOURCES},
        "nwr/leisure": {"swimming_pool"},
    }
    return [f"{key}={','.join(sorted(values))}" for key, values in expressions.items()]


def water_kind(tags: osmium.osm.TagList) -> str | None:
    """Which of the map's water layers an element goes in, if any. Indoor pools are left out, since an engine can't draft from them."""
    emergency = tags.get("emergency")
    if emergency == "fire_hydrant":
        return "hydrant"
    if emergency in WATER_SOURCES:
        return "water_source"
    if tags.get("leisure") == "swimming_pool" and tags.get("indoor") != "yes":
        return "pool"
    return None


def format_weight(maxweight: str) -> str:
    """A maxweight tag in US tons, rounded down to a tenth so the limit shown is never above the real one, or as tagged if its unit isn't recognized."""
    match = re.fullmatch(r"([\d.]+)\s*([a-z]*)", maxweight.strip().lower())
    pounds = POUNDS_PER_UNIT.get(match[2]) if match else None
    try:
        number = float(match[1]) if match else None
    except ValueError:
        number = None
    if pounds is None or number is None:
        return maxweight
    tons = math.floor(number * pounds / 200) / 10
    return f"{int(tons) if tons.is_integer() else tons} tons"


def length_meters(coords: Coords) -> float:
    """The great-circle length of a line of (lon, lat)."""
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in itertools.pairwise(coords):
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        h = (
            math.sin((phi2 - phi1) / 2) ** 2
            + math.cos(phi1)
            * math.cos(phi2)
            * math.sin(math.radians(lon2 - lon1) / 2) ** 2
        )
        total += 2 * 6371000 * math.asin(math.sqrt(h))
    return total


def may_dead_end(tags: osmium.osm.TagList, coords: Coords) -> bool:
    """Whether a road ending with no other road there is worth flagging."""
    highway = tags.get("highway")
    if highway == "track" or tags.get("area") == "yes":
        return False
    if highway != "service":
        return True
    service = tags.get("service")
    if service in NON_ROUTE_SERVICE:
        return False
    if service == "driveway":
        return length_meters(coords) >= MIN_DEAD_END_DRIVEWAY_METERS
    return True


def use_counts(
    candidates: np.ndarray, refs: np.ndarray, chunk: int = 50_000_000
) -> np.ndarray:
    """How many times each of the sorted, unique `candidates` appears in `refs`, a chunk at a time to keep memory down."""
    counts = np.zeros(len(candidates), dtype=np.int64)
    if not len(candidates):
        return counts
    for start in range(0, len(refs), chunk):
        part = refs[start : start + chunk]
        index = np.searchsorted(candidates, part).clip(max=len(candidates) - 1)
        found = candidates[index] == part
        counts += np.bincount(index[found], minlength=len(candidates))
    return counts


class Writer:
    """One GeoJSONSeq file per layer in LAYERS, each feature tagged with its layer's min zoom for tippecanoe."""

    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        self.counts: Counter[str] = Counter()

    def __enter__(self) -> Self:
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.stack = ExitStack()
        self.files: dict[str, TextIO] = {
            # closed by the stack, in __exit__
            layer: self.stack.enter_context(
                open(self.out_dir / f"{layer}.geojsonl", "w")  # noqa: SIM115
            )
            for layer in LAYERS
        }
        return self

    def __exit__(self, *exc_info):
        self.stack.close()

    def write(self, layer: str, geometry: dict, properties: dict | None = None):
        feature = {
            "type": "Feature",
            # https://github.com/felt/tippecanoe#geojson-extension
            "tippecanoe": {"minzoom": LAYERS[layer]},
            "geometry": geometry,
            "properties": properties or {},
        }
        self.files[layer].write(json.dumps(feature, separators=(",", ":")) + "\n")
        self.counts[layer] += 1

    def point(self, layer: str, lon: float, lat: float, properties: dict | None = None):
        coords = [round(lon, PRECISION), round(lat, PRECISION)]
        self.write(layer, {"type": "Point", "coordinates": coords}, properties)

    def line(self, layer: str, coords: Coords, properties: dict | None = None):
        rounded = [
            [round(lon, PRECISION), round(lat, PRECISION)] for lon, lat in coords
        ]
        self.write(layer, {"type": "LineString", "coordinates": rounded}, properties)


def center(rings: Iterable[osmium.osm.OuterRing]) -> tuple[float, float] | None:
    """The middle of an area's bounding box, like Overpass's `out center`."""
    lons, lats = [], []
    for ring in rings:
        for node in ring:
            lons.append(node.lon)
            lats.append(node.lat)
    if not lons:
        return None
    return (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2


class AccessLayers:
    """Writes each layer's features as the extract's objects go by, holding on to what finding gates and dead ends needs until the end. Road nodes go in compact arrays, since there are hundreds of millions of them across the US."""

    def __init__(self, out: Writer):
        self.out = out
        # node id -> (lon, lat), for vehicle barriers, until a drivable road through them turns up
        self.barriers: dict[int, tuple[float, float]] = {}
        self.gates: set[int] = set()
        self.turnarounds: set[int] = set()
        # every node of every drivable road, for counting how many roads use each road end
        self.road_nodes = array("q")
        # the ends of roads that may dead-end, and where they are
        self.ends, self.end_lons, self.end_lats = array("q"), array("d"), array("d")

    def node(self, node: osmium.osm.Node):
        tags = node.tags
        if kind := water_kind(tags):
            self.out.point("water", node.lon, node.lat, {"kind": kind})
        if tags.get("barrier") in VEHICLE_BARRIERS:
            self.barriers[node.id] = (node.lon, node.lat)
        if tags.get("highway") in TURNAROUNDS:
            self.turnarounds.add(node.id)

    def way(self, way: osmium.osm.Way):
        tags = way.tags
        if tags.get("highway") not in DRIVABLE_HIGHWAYS:
            return
        try:
            coords = [(n.lon, n.lat) for n in way.nodes]
        except osmium.InvalidLocationError:
            # a node outside the extract
            return
        ids = [n.ref for n in way.nodes]
        self.road_nodes.extend(ids)
        self.gates.update(ref for ref in ids if ref in self.barriers)
        oneway = tags.get("oneway")
        if oneway in ("yes", "1", "-1"):
            self.out.line("oneway", coords, {"oneway": -1 if oneway == "-1" else 1})
        bridge, maxweight = tags.get("bridge"), tags.get("maxweight")
        if bridge and bridge != "no" and maxweight:
            self.out.line("weight-limits", coords, {"label": format_weight(maxweight)})
        # a closed loop has no end
        if ids[0] != ids[-1] and may_dead_end(tags, coords):
            for i in (0, -1):
                self.ends.append(ids[i])
                self.end_lons.append(coords[i][0])
                self.end_lats.append(coords[i][1])

    def area(self, area: osmium.osm.Area):
        kind = water_kind(area.tags)
        if kind and (point := center(area.outer_rings())):
            self.out.point("water", *point, {"kind": kind})

    def finish(self):
        """Writes the gates and dead ends, which need every road seen first."""
        for ref in self.gates:
            self.out.point("gates", *self.barriers[ref])
        # a road end no other road touches, with no turnaround mapped there
        end_ids = np.frombuffer(self.ends, dtype=np.int64)
        candidates = np.unique(end_ids)
        counts = use_counts(candidates, np.frombuffer(self.road_nodes, dtype=np.int64))
        uses = counts[np.searchsorted(candidates, end_ids)] if len(candidates) else []
        for ref, lon, lat, n in zip(end_ids, self.end_lons, self.end_lats, uses):
            if n == 1 and int(ref) not in self.turnarounds:
                self.out.point("dead-ends", lon, lat)


def extract(pbf: Path, out_dir: Path) -> Counter[str]:
    """Writes the layers from `pbf` (filtered down to the tags used here, or not) to `out_dir`, and returns how many features each got."""
    processor = (
        osmium.FileProcessor(str(pbf))
        # sparse rather than the default, which can pick a dense array sized to the largest node ID (billions) for big extracts
        .with_locations("sparse_mem_array")
        # only the areas that can be water sources need assembling
        .with_areas(osmium.filter.KeyFilter("emergency", "leisure"))
    )
    with Writer(out_dir) as out:
        layers = AccessLayers(out)
        for obj in processor:
            if isinstance(obj, osmium.osm.Node):
                layers.node(obj)
            elif isinstance(obj, osmium.osm.Way):
                layers.way(obj)
            elif isinstance(obj, osmium.osm.Area):
                layers.area(obj)
        layers.finish()
    return out.counts


# `filters` prints osmium_filters(), one per line; `<pbf> <out_dir>` runs extract()
if __name__ == "__main__":
    if sys.argv[1:] == ["filters"]:
        print("\n".join(osmium_filters()))
    else:
        pbf, out_dir = sys.argv[1:]
        print(json.dumps(extract(Path(pbf), Path(out_dir))))
