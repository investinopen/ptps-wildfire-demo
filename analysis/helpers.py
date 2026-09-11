import asyncio
from collections.abc import Iterable
from pathlib import Path

import geopandas as gpd
import httpx
import matplotlib
import matplotlib.colors as mcolors
import pandas as pd
from duckdb import DuckDBPyConnection
from IPython.display import HTML

from ptps_wildfire_demo.constants import USER_AGENT


def run_script_in_db(conn: DuckDBPyConnection, path: Path | str):
    with open(path, "r") as f:
        sql = f.read()

    conn.execute(sql)


def to_hex_color_map(values: pd.Series, cmap: str) -> pd.Series:
    """Scale `values` into `cmap`, returned as hex strings for use in a Folium
    `style_function`. cmap options:
    https://matplotlib.org/stable/gallery/color/colormap_reference.html"""

    vmin = values.min()
    vmax = values.max()
    span = vmax - vmin
    scaled = (values - vmin) / span if span else pd.Series(0.0, index=values.index)

    cmap_obj = matplotlib.colormaps[cmap]
    return scaled.apply(lambda v: mcolors.to_hex(cmap_obj(v)))


def read_geo(
    conn: DuckDBPyConnection, query: str, geom_col: str = "geom", crs: str = "EPSG:4326"
) -> gpd.GeoDataFrame:
    """Run `query` and return a GeoDataFrame. The geometry column must be WKT --
    wrap it in `ST_AsText(...)` in the SELECT. (DuckDB hands back WKB as bytearray,
    which shapely rejects; WKT sidesteps that.)"""
    df = conn.execute(query).df()
    return gpd.GeoDataFrame(
        df.drop(columns=geom_col),
        geometry=gpd.GeoSeries.from_wkt(df[geom_col]),
        crs=crs,
    )


async def get_status(client: httpx.AsyncClient, url: str) -> str:
    headers = {"User-Agent": USER_AGENT}

    try:
        response = await client.head(
            url,
            headers=headers,
            follow_redirects=True,
            timeout=20,
        )
    except httpx.TimeoutException:
        return "🔴 timeout"
    except httpx.HTTPError as error:
        return f"🔴 error: {error}"

    status = response.status_code
    if 200 <= status < 300:
        return f"🟢 {status}"
    if 300 <= status < 400:
        return f"🟡 {status}"
    return f"🔴 {status}"


async def get_statuses(client: httpx.AsyncClient, urls: Iterable[str]) -> list[str]:
    return await asyncio.gather(*(get_status(client, url) for url in urls))


def de_wayback(series: pd.Series[str]):
    """Removes the Wayback Machine prefix from a Series of URLs"""
    return series.str.replace(r"https?://web\.archive\.org/web/\d+/", "", regex=True)


def render_links(data: pd.DataFrame):
    return HTML(data.to_html(render_links=True))
