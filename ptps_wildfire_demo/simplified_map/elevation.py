import io

import httpx
import networkx as nx
import numpy as np
from PIL import Image
from pyproj import Transformer

# the same terrain tiles as the detailed firefighter map's topographic shading
TILE_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"
TILE_SIZE = 512
TILE_ZOOM = 14  # ~5 meters per pixel at this latitude, finer than the grade span
# degrees added around the network, since edges can bulge out past their end nodes
MARGIN_DEGREES = 0.01


def lonlat_to_pixel(lon, lat, zoom: int = TILE_ZOOM):
    """Global pixel coordinates at `zoom`, in Web Mercator."""
    scale = TILE_SIZE * 2**zoom
    x = (np.asarray(lon) + 180) / 360 * scale
    y = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * scale
    return x, y


def decode_terrarium(rgb: np.ndarray) -> np.ndarray:
    """Elevation in meters from a Terrarium-encoded RGB tile."""
    # https://github.com/tilezen/joerd/blob/master/docs/formats.md#terrarium
    r, g, b = (rgb[..., c].astype(float) for c in range(3))
    return r * 256 + g + b / 256 - 32768


class ElevationModel:
    """Elevations over a mosaic of terrain tiles, looked up by projected coordinates."""

    def __init__(self, dem: np.ndarray, origin: tuple[int, int], crs):
        # `origin` is the global pixel coordinates of the mosaic's top left corner
        self.dem = dem
        self.origin = origin
        self.to_lonlat = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    @classmethod
    def for_graph(cls, G: nx.MultiGraph) -> "ElevationModel":
        """Downloads the tiles covering a projected road network."""
        to_lonlat = Transformer.from_crs(G.graph["crs"], "EPSG:4326", always_xy=True)
        lons, lats = to_lonlat.transform(
            [d["x"] for _, d in G.nodes(data=True)],
            [d["y"] for _, d in G.nodes(data=True)],
        )
        px_min = lonlat_to_pixel(min(lons) - MARGIN_DEGREES, max(lats) + MARGIN_DEGREES)
        px_max = lonlat_to_pixel(max(lons) + MARGIN_DEGREES, min(lats) - MARGIN_DEGREES)
        tx_range = range(int(px_min[0] // TILE_SIZE), int(px_max[0] // TILE_SIZE) + 1)
        ty_range = range(int(px_min[1] // TILE_SIZE), int(px_max[1] // TILE_SIZE) + 1)

        dem = np.zeros((len(ty_range) * TILE_SIZE, len(tx_range) * TILE_SIZE))
        with httpx.Client(timeout=30) as client:
            for j, ty in enumerate(ty_range):
                for i, tx in enumerate(tx_range):
                    response = client.get(TILE_URL.format(z=TILE_ZOOM, x=tx, y=ty))
                    response.raise_for_status()
                    rgb = np.asarray(
                        Image.open(io.BytesIO(response.content)).convert("RGB")
                    )
                    dem[
                        j * TILE_SIZE : (j + 1) * TILE_SIZE,
                        i * TILE_SIZE : (i + 1) * TILE_SIZE,
                    ] = decode_terrarium(rgb)
        origin = (tx_range.start * TILE_SIZE, ty_range.start * TILE_SIZE)
        return cls(dem, origin, G.graph["crs"])

    def __call__(self, xs, ys) -> np.ndarray:
        """Elevation in meters at projected points, bilinearly interpolated."""
        lon, lat = self.to_lonlat.transform(xs, ys)
        px, py = lonlat_to_pixel(lon, lat)
        # pixel centers are at +0.5
        px = px - self.origin[0] - 0.5
        py = py - self.origin[1] - 0.5
        x0, y0 = np.floor(px).astype(int), np.floor(py).astype(int)
        fx, fy = px - x0, py - y0
        dem = self.dem
        return (
            dem[y0, x0] * (1 - fx) * (1 - fy)
            + dem[y0, x0 + 1] * fx * (1 - fy)
            + dem[y0 + 1, x0] * (1 - fx) * fy
            + dem[y0 + 1, x0 + 1] * fx * fy
        )
