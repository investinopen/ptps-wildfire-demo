from dataclasses import dataclass, fields
from datetime import UTC, datetime
from types import SimpleNamespace

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
import osmnx as ox
from IPython.display import Markdown, display
from pyproj import Transformer
from shapely import Point

from ptps_wildfire_demo.simplified_map.addresses import place_addresses
from ptps_wildfire_demo.simplified_map.drawing import Diagram
from ptps_wildfire_demo.simplified_map.elevation import ElevationModel
from ptps_wildfire_demo.simplified_map.layout import Layout, layout
from ptps_wildfire_demo.simplified_map.links import detailed_map_url, openstreetmap_url
from ptps_wildfire_demo.simplified_map.network import drop_short_driveways, fetch_roads
from ptps_wildfire_demo.simplified_map.profile import add_profiles


@dataclass
class Settings:
    # fire apparatus access roads "shall not exceed 10 percent in grade" under the International Fire Code (Appendix D103.2), unless the fire code official approves otherwise
    max_grade: float = 0.10
    steep_grade: float = 0.15
    # grades are measured over this distance, so one noisy elevation sample doesn't read as a cliff
    grade_span_meters: float = 50
    # a bend that turns at least this much within turn_span_meters on either side gets marked -- roughly a curve tighter than a 30-meter (100-foot) radius
    sharp_turn_degrees: float = 110
    turn_span_meters: float = 30
    # same as the detailed firefighter map's dead ends: short driveways can be backed out of, so they're left off
    min_driveway_meters: float = 150
    # how finely roads are sampled for grades and turns
    step_meters: float = 10
    # how far an address can be from its road; beyond this, it's left off
    max_address_meters: float = 300
    # how much the layout's weaker pulls count, relative to roads' lengths (see layout.layout()) -- higher keeps closer to the actual geography / spreads the diagram out more evenly, at the cost of roads' lengths being less exact
    geography_weight: float = 0.001
    spacing_weight: float = 0.001
    # the zoomed-in page shows the part of the diagram for intersections within this distance of the center on the ground
    zoomed_radius_meters: float = 400

    def text(self) -> SimpleNamespace:
        """Each setting written out for prose, by the same name, e.g. min_driveway_meters as "150 m", max_grade as "10%", or sharp_turn_degrees as "110°"."""

        def written(name, value):
            if name.endswith("_meters"):
                return f"{value:,.0f} m"
            if name.endswith("_grade"):
                return f"{value:.0%}"
            if name.endswith("_degrees"):
                return f"{value:.0f}°"
            return f"{value:g}"

        return SimpleNamespace(
            **{f.name: written(f.name, getattr(self, f.name)) for f in fields(self)}
        )


def bounds_around(
    G: nx.MultiGraph, pos: dict, center: Point, radius_meters: float
) -> tuple[float, float, float, float]:
    """The part of the layout (xmin, ymin, xmax, ymax) holding the intersections within `radius_meters` of `center` on the ground, plus a margin."""
    near = np.array(
        [
            pos[n]
            for n, d in G.nodes(data=True)
            if center.distance(Point(d["x"], d["y"])) <= radius_meters
        ]
    )
    (xmin, ymin), (xmax, ymax) = near.min(axis=0), near.max(axis=0)
    margin = 0.1 * max(xmax - xmin, ymax - ymin)
    return xmin - margin, ymin - margin, xmax + margin, ymax + margin


@dataclass
class SimplifiedMap:
    """The roads within `radius_meters` of `center` (lat, lon), drawn as a graph to scale by driving distance. Use build() to make one."""

    place_name: str
    center: tuple[float, float]
    radius_meters: float
    settings: Settings
    # the road network: intersections, dead ends, and gates as nodes, the roads between them as edges
    G: nx.MultiGraph
    elevation: ElevationModel
    layout: Layout
    diagram: Diagram
    center_point: Point
    # how many addresses were found, placed, and placed on driveways
    addresses: tuple[int, int, int]
    run_at: datetime

    @classmethod
    def build(
        cls,
        place_name: str,
        center: tuple[float, float],
        radius_meters: float,
        settings: Settings | None = None,
        cache_folder: str = "data_cache/osmnx",
    ) -> "SimplifiedMap":
        """Fetches the roads, elevation, and addresses, and lays out the diagram. OpenStreetMap responses are cached in `cache_folder` (relative to the working directory), which isn't committed -- see .gitignore."""
        settings = settings or Settings()
        ox.settings.cache_folder = cache_folder
        run_at = datetime.now(UTC)
        G = fetch_roads(center, radius_meters)
        drop_short_driveways(G, settings.min_driveway_meters)

        elevation = ElevationModel.for_graph(G)
        add_profiles(
            G,
            elevation,
            step_meters=settings.step_meters,
            grade_span_meters=settings.grade_span_meters,
            turn_degrees=settings.sharp_turn_degrees,
            turn_span_meters=settings.turn_span_meters,
        )

        found = ox.features_from_point(
            center, tags={"addr:housenumber": True}, dist=radius_meters
        ).to_crs(G.graph["crs"])
        # buildings/lots are mapped as areas
        found["geometry"] = found.geometry.representative_point()
        placed, on_driveways = place_addresses(G, found, settings.max_address_meters)

        result = layout(G, settings.geography_weight, settings.spacing_weight)
        to_projected = Transformer.from_crs("EPSG:4326", G.graph["crs"], always_xy=True)
        center_point = Point(*to_projected.transform(center[1], center[0]))
        diagram = Diagram(
            G,
            result.pos,
            center_point,
            radius_meters,
            grade_limits=(settings.max_grade, settings.steep_grade),
            note=(
                "Each road's length is proportional to how far it is to drive, not where it is on the ground, though places farther north are still higher up on the page, and so on. "
                f"Colors show the steepest grade over any {settings.grade_span_meters:.0f} m. "
                "House numbers are beside their road at their distance down it, on the side the house is, where there's room. "
                f"Driveways under {settings.min_driveway_meters:.0f} m are left off.\n\n"
                f"Roads © OpenStreetMap contributors. Elevation © Mapterhorn. Generated {run_at:%Y-%m-%d}. "
                "A proof of concept that hasn't been validated; use at your own risk."
            ),
        )
        return cls(
            place_name,
            center,
            radius_meters,
            settings,
            G,
            elevation,
            result,
            diagram,
            center_point,
            (len(found), placed, on_driveways),
            run_at,
        )

    def show(self, zoomed: bool = False):
        """Displays the whole area (or with `zoomed`, the middle of town) in a notebook, with links to the same area on regular maps."""
        if zoomed:
            radius = self.settings.zoomed_radius_meters
            bounds = bounds_around(self.G, self.layout.pos, self.center_point, radius)
            title = f"{self.place_name}: middle of town"
        else:
            radius, bounds = self.radius_meters, None
            title = f"{self.place_name}: roads, to scale by driving distance"
        self.diagram.draw(title, bounds)
        plt.show()
        notes = [
            f"Click to enlarge. The same area on the [detailed firefighter map]({detailed_map_url(self.center, radius)}) and [OpenStreetMap]({openstreetmap_url(self.center, radius)})."
        ]
        if self.diagram.unlabeled:
            notes.append(f"No room to label: {', '.join(self.diagram.unlabeled)}.")
        display(Markdown(" ".join(notes)))

    def summary(self) -> Markdown:
        """How the network, grades, addresses, and layout came out, as a list."""
        G, settings, result = self.G, self.settings, self.layout
        edges = [data for _, _, data in G.edges(data=True)]
        steep = sum(data["grade"] >= settings.max_grade for data in edges)
        turns = sum(len(data["turns"]) for data in edges)
        found, placed, on_driveways = self.addresses
        return Markdown(
            "\n".join(
                [
                    f"- Run {self.run_at:%Y-%m-%d %H:%M} UTC",
                    f"- {len(G.nodes):,} intersections, dead ends, and gates, joined by {len(G.edges):,} roads",
                    f"- Elevations from {self.elevation.dem.min():,.0f} to {self.elevation.dem.max():,.0f} m",
                    f"- {steep} of {len(edges)} roads are steeper than {settings.max_grade:.0%} somewhere, and there are {turns} sharp turns",
                    f"- {placed} of {found} addresses placed, {on_driveways} of them on driveways",
                    f"- Road lengths on the page are within {np.percentile(result.length_error, 95):.0%} of scale for 95% of roads, and {result.length_error.max():.0%} at worst",
                    f"- {result.north_south_flipped:.1%} of pairs of intersections are out of order north-south, and {result.east_west_flipped:.1%} east-west",
                ]
            )
        )
