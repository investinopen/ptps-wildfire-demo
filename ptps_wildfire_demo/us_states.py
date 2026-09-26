"""Generates the US state boundaries that the detailed firefighter map uses to name the state in its sidebar heading. Run from the repo root:

uv run python -m ptps_wildfire_demo.us_states
"""

import json
from pathlib import Path

import geopandas as gpd
import shapely

# the Census Bureau's generalized state boundaries (public domain), at their coarsest scale -- plenty for telling which state a town is in, and small enough to ship with the page
# https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html
SOURCE_URL = "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_20m.zip"
# degrees, ~200 m -- finer than the source's own generalization, so it only trims points that don't matter
SIMPLIFY_TOLERANCE = 0.002
PRECISION = 0.001
OUTPUT_PATH = Path("site/firefighter-maps/detailed/us-states.geojson")


def state_features() -> list[dict]:
    states = gpd.read_file(SOURCE_URL).sort_values("NAME")
    features = []
    for name, geometry in zip(states["NAME"], states.geometry):
        geometry = shapely.set_precision(
            geometry.simplify(SIMPLIFY_TOLERANCE), PRECISION
        )
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name},
                "geometry": shapely.geometry.mapping(geometry),
            }
        )
    return features


def main():
    # one feature per line, so a regenerated file diffs state by state
    lines = [json.dumps(f, separators=(",", ":")) for f in state_features()]
    OUTPUT_PATH.write_text(
        '{"type":"FeatureCollection","features":[\n' + ",\n".join(lines) + "\n]}\n"
    )


if __name__ == "__main__":
    main()
