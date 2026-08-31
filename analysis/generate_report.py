"""Generates an HTML report equivalent to fire_datasets.ipynb, with clickable links."""

import asyncio
import html
import math
import sys
from pathlib import Path

import httpx
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup

repo_root = next(
    path
    for path in (Path.cwd(), *Path.cwd().parents)
    if (path / "ptps_wildfire_demo").is_dir()
)
sys.path.insert(0, str(repo_root))

from helpers import get_statuses

from ptps_wildfire_demo.proxy.resolver import Resolver

ANALYSIS_DIR = Path(__file__).parent
OUTPUT_PATH = ANALYSIS_DIR / "fire_datasets_report.html"


def get_datasets_to_check(datasets: pd.DataFrame) -> pd.DataFrame:
    """Only include the official government data sources that don't require auth."""

    no_auth = datasets["access_type"] != "Free key"
    not_src_coop = ~datasets["webpage"].str.startswith("https://source.coop/")
    not_dryad = ~datasets["webpage"].str.contains("/dryad.")
    has_example_data_url = datasets["example_data_url"].notna()

    return datasets[no_auth & not_src_coop & not_dryad & has_example_data_url]


async def get_example_data_url_results(
    client: httpx.AsyncClient, resolver: Resolver, datasets_to_check: pd.DataFrame
) -> pd.DataFrame:
    statuses, rescues = await asyncio.gather(
        get_statuses(client, datasets_to_check["example_data_url"]),
        asyncio.gather(
            *(resolver.get_rescue(url) for url in datasets_to_check["example_data_url"])
        ),
    )

    rescues_df = pd.DataFrame(rescues).rename(
        columns={"original_url": "example_data_url"}
    )
    rescues_df.insert(1, "example_data_url_status", statuses)

    results = pd.merge(datasets_to_check, rescues_df, on="example_data_url")
    return results.drop(
        columns=["access_type", "webpage", "description", "resolved_url"]
    )


async def get_webpage_results(
    client: httpx.AsyncClient, resolver: Resolver, datasets: pd.DataFrame
) -> pd.DataFrame:
    page_statuses, page_rescues = await asyncio.gather(
        get_statuses(client, datasets["webpage"]),
        asyncio.gather(*(resolver.get_rescue(url) for url in datasets["webpage"])),
    )

    page_rescues_df = pd.DataFrame(page_rescues)
    page_rescues_df.insert(2, "resolved_url_status", page_statuses)

    return page_rescues_df.drop(columns="resolved_url")


def linkify(value: object) -> Markup:
    """Renders a URL as a clickable link; passes through other values as escaped text."""

    if value is None or (isinstance(value, float) and math.isnan(value)):
        return Markup('<span class="empty">—</span>')

    text = str(value)
    if text.startswith(("http://", "https://")):
        escaped = html.escape(text)
        return Markup(
            f'<a href="{escaped}" target="_blank" rel="noopener">{escaped}</a>'
        )

    return Markup(html.escape(text))


async def main():
    async with httpx.AsyncClient() as client:
        resolver = Resolver(client)

        datasets = pd.read_csv(ANALYSIS_DIR / "fire_datasets.csv")
        datasets_to_check = get_datasets_to_check(datasets)

        example_data_url_results, webpage_results = await asyncio.gather(
            get_example_data_url_results(client, resolver, datasets_to_check),
            get_webpage_results(client, resolver, datasets),
        )

    env = Environment(loader=FileSystemLoader(ANALYSIS_DIR))
    env.filters["linkify"] = linkify
    template = env.get_template("report_template.html")
    html = template.render(
        example_data_url_columns=list(example_data_url_results.columns),
        example_data_url_rows=example_data_url_results.to_dict(orient="records"),
        webpage_columns=list(webpage_results.columns),
        webpage_rows=webpage_results.to_dict(orient="records"),
    )

    OUTPUT_PATH.write_text(html)
    print(f"Wrote report to {OUTPUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
