"""Generates an HTML report equivalent to fire_datasets.ipynb, with clickable links."""

import asyncio
import html
import math
import sys
from datetime import UTC, datetime
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
OUTPUT_PATH = ANALYSIS_DIR / "fire-datasets-report.html"


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
        columns={
            "original_url": "example_data_url",
            "wayback_newest_url": "example_data_url_wayback_url",
            "drp_url": "example_data_url_drp_url",
        }
    )
    rescues_df.insert(1, "example_data_url_status", statuses)

    results = pd.merge(
        datasets_to_check[["name", "example_data_url"]],
        rescues_df,
        on="example_data_url",
    )
    return results.drop(columns="resolved_url")


async def get_webpage_results(
    client: httpx.AsyncClient, resolver: Resolver, datasets: pd.DataFrame
) -> pd.DataFrame:
    page_statuses, page_rescues = await asyncio.gather(
        get_statuses(client, datasets["webpage"]),
        asyncio.gather(*(resolver.get_rescue(url) for url in datasets["webpage"])),
    )

    page_rescues_df = pd.DataFrame(page_rescues).rename(
        columns={
            "original_url": "webpage",
            "wayback_newest_url": "webpage_wayback_url",
            "drp_url": "webpage_drp_url",
        }
    )
    page_rescues_df.insert(1, "webpage_status", page_statuses)

    results = pd.merge(
        datasets[["name", "description", "webpage"]], page_rescues_df, on="webpage"
    )
    return results.drop(columns="resolved_url")


def get_dataset_sections(
    webpage_results: pd.DataFrame, example_data_url_results: pd.DataFrame
) -> list[dict]:
    """Builds one section per dataset, each with a row for its webpage and (if checked) example data URL."""

    consolidated = pd.merge(
        webpage_results, example_data_url_results, on="name", how="left"
    )

    sections = []
    for dataset in consolidated.to_dict(orient="records"):
        rows = [
            {
                "type": "Webpage",
                "url": dataset["webpage"],
                "status": dataset["webpage_status"],
                "wayback_url": dataset["webpage_wayback_url"],
                "drp_url": dataset["webpage_drp_url"],
            }
        ]
        if pd.notna(dataset["example_data_url"]):
            rows.append(
                {
                    "type": "Example data URL",
                    "url": dataset["example_data_url"],
                    "status": dataset["example_data_url_status"],
                    "wayback_url": dataset["example_data_url_wayback_url"],
                    "drp_url": dataset["example_data_url_drp_url"],
                }
            )

        sections.append(
            {
                "name": dataset["name"],
                "description": dataset["description"],
                "rows": rows,
            }
        )

    return sections


def link_label(url: object, label: str) -> Markup:
    """Renders a label as a link to the given URL."""

    escaped_label = html.escape(label)
    if url is None or (isinstance(url, float) and math.isnan(url)):
        return Markup(escaped_label)

    escaped_url = html.escape(str(url))
    return Markup(
        f'<a href="{escaped_url}" target="_blank" rel="noopener">{escaped_label}</a>'
    )


def yes_no(url: object) -> Markup:
    """Renders "Yes" (linked to the given URL) or "No" if there's no URL."""

    if url is None or (isinstance(url, float) and math.isnan(url)):
        return Markup("No")

    escaped_url = html.escape(str(url))
    return Markup(f'<a href="{escaped_url}" target="_blank" rel="noopener">Yes</a>')


async def main():
    async with httpx.AsyncClient() as client:
        resolver = Resolver(client)

        datasets = pd.read_csv(ANALYSIS_DIR / "fire_datasets.csv")
        datasets_to_check = get_datasets_to_check(datasets)

        webpage_results, example_data_url_results = await asyncio.gather(
            get_webpage_results(client, resolver, datasets),
            get_example_data_url_results(client, resolver, datasets_to_check),
        )

    consolidated_results = get_dataset_sections(
        webpage_results, example_data_url_results
    )

    env = Environment(loader=FileSystemLoader(ANALYSIS_DIR))
    env.filters["link_label"] = link_label
    env.filters["yes_no"] = yes_no
    template = env.get_template("report_template.html.jinja")
    html = template.render(
        datasets=consolidated_results,
        generated_at=datetime.now(UTC),
    )

    OUTPUT_PATH.write_text(html)
    print(f"Wrote report to {OUTPUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
