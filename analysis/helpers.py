import asyncio
from collections.abc import Iterable
from html import escape
from pathlib import Path

import folium
import geopandas as gpd
import httpx
import pandas as pd
from duckdb import DuckDBPyConnection
from IPython.display import HTML

from ptps_wildfire_demo.constants import USER_AGENT


def run_script_in_db(conn: DuckDBPyConnection, path: Path | str):
    with open(path, "r") as f:
        sql = f.read()

    conn.execute(sql)


def add_map_caption(
    m: folium.Map,
    title: str,
    subtitle: str | None = None,
    legend: dict[str, str] | None = None,
):
    """Add a title box, with an optional legend, to the bottom left of a Folium map --
    bottom left since branca always puts colormap legends in the top right. `legend`
    maps each label to the CSS for its swatch, e.g. `{"warned": "background: red"}`."""

    lines = [f"<strong style='font-size: 14px;'>{escape(title)}</strong>"]
    if subtitle:
        lines.append(escape(subtitle))
    for label, swatch_css in (legend or {}).items():
        lines.append(
            "<span style='display: inline-block; width: 12px; height: 12px; "
            f"margin-right: 4px; vertical-align: middle; {swatch_css}'></span>"
            f"{escape(label)}"
        )

    m.get_root().html.add_child(
        folium.Element(
            '<div style="position: absolute; bottom: 24px; left: 10px; z-index: 1000; '
            "padding: 4px 10px; background: rgba(255, 255, 255, 0.85); "
            'border-radius: 4px; font: 12px sans-serif;">'
            + "<br>".join(lines)
            + "</div>"
        )
    )


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
