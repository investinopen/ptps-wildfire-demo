import math

# meters per pixel at zoom 0 at the equator, for 256-pixel web map tiles
METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03
# roughly half of a typical browser window's height, in pixels
HALF_VIEW_PIXELS = 400


def zoom_for(lat: float, radius_meters: float) -> float:
    """A web map zoom level that shows about `radius_meters` around a point at `lat`, in a typical browser window."""
    return math.log2(
        METERS_PER_PIXEL_AT_ZOOM_0
        * math.cos(math.radians(lat))
        * HALF_VIEW_PIXELS
        / radius_meters
    )


def detailed_map_url(
    center: tuple[float, float], radius_meters: float, base: str = "../detailed/"
) -> str:
    """The detailed firefighter map, showing about `radius_meters` around `center` (lat, lon). `base` is the map's URL, relative to the page linking to it."""
    lat, lon = center
    # MapLibre's #zoom/lat/lon
    return f"{base}#{zoom_for(lat, radius_meters):.2f}/{lat:.5f}/{lon:.5f}"


def openstreetmap_url(center: tuple[float, float], radius_meters: float) -> str:
    """openstreetmap.org, showing about `radius_meters` around `center` (lat, lon)."""
    lat, lon = center
    # it only takes whole zoom levels
    return f"https://www.openstreetmap.org/#map={round(zoom_for(lat, radius_meters))}/{lat:.5f}/{lon:.5f}"
