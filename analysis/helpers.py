from pathlib import Path

import geopandas as gpd
import matplotlib
import pandas as pd
from duckdb import DuckDBPyConnection
from lonboard.colormap import apply_continuous_cmap


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
