import asyncio
from collections.abc import Iterable
from pathlib import Path

import geopandas as gpd
import httpx
import matplotlib
import pandas as pd
from duckdb import DuckDBPyConnection
from lonboard.colormap import apply_continuous_cmap

from ptps_wildfire_demo.proxy.constants import USER_AGENT


def run_script_in_db(conn: DuckDBPyConnection, path: Path | str):
    with open(path, "r") as f:
        sql = f.read()

    conn.execute(sql)


def to_continuous_color_map(values: pd.Series, cmap: str):
    """cmap options: https://matplotlib.org/stable/gallery/color/colormap_reference.html"""

    vmin = values.min()
    vmax = values.max()
    scaled = (values - vmin) / (vmax - vmin)

    cmap_obj = matplotlib.colormaps[cmap]
    return apply_continuous_cmap(scaled, cmap_obj)


def get_geo_df(conn: DuckDBPyConnection, query: str, geom_col="geom"):
    df = conn.execute(query).df()
    return gpd.GeoDataFrame(df, geometry=geom_col)


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
