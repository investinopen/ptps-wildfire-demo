"""Renders the report, for rescue-status.qmd, checking the rescue status of the example wildfire datasets, with clickable links."""

import asyncio
import html
import math
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup

from analysis.helpers import get_statuses
from ptps_wildfire_demo import Resolver

ANALYSIS_DIR = Path(__file__).parent


def get_datasets_to_check(datasets: pd.DataFrame) -> pd.DataFrame:
    """Only include datasets that have an example data URL to check."""

    has_example_data_url = datasets["example_data_url"].notna()
    return datasets[has_example_data_url]


def is_wayback_applicable(access_type: pd.Series) -> pd.Series:
    """Free-key-gated example data URLs generally aren't archivable by the Wayback Machine."""

    return access_type != "Free key"


def is_drp_applicable(webpage: pd.Series) -> pd.Series:
    """The Data Rescue Project Portal doesn't catalog source.coop or Dryad-hosted datasets."""

    not_src_coop = ~webpage.str.startswith("https://source.coop/")
    not_dryad = ~webpage.str.contains("/dryad.")
    return not_src_coop & not_dryad


def get_drp_repositories(resolver: Resolver, drp_url: str | None) -> list[dict]:
    """The repositories holding a Data Rescue Project dataset's rescued copies, named by
    host (the Portal doesn't name them), each linked to its copy."""

    if drp_url is None:
        return []

    matches = resolver.drp_rescues[resolver.drp_rescues["url"] == drp_url]
    repositories: dict[str, str] = {}
    for resources in matches["resources"]:
        for resource in resources if resources is not None else []:
            host = urlparse(resource["url"] or "").hostname
            if host:
                repositories.setdefault(host.removeprefix("www."), resource["url"])

    return [{"name": name, "url": url} for name, url in repositories.items()]


URL_TYPES = {"webpage": "Webpage", "example_data_url": "Example data URL"}


async def get_url_results(
    client: httpx.AsyncClient,
    resolver: Resolver,
    datasets: pd.DataFrame,
    url_column: str,
) -> pd.DataFrame:
    """Checks the status and rescues of each dataset's URL in the given column, one row per dataset."""

    urls = datasets[url_column]
    statuses, rescues = await asyncio.gather(
        get_statuses(client, urls),
        asyncio.gather(*(resolver.get_rescue(url) for url in urls)),
    )

    results = datasets[["name", "description"]].copy()
    results["type"] = URL_TYPES[url_column]
    results["url"] = urls
    results["status"] = statuses
    results["wayback_url"] = [rescue.wayback_newest_url for rescue in rescues]
    results["wayback_applicable"] = (
        is_wayback_applicable(datasets["access_type"])
        if url_column == "example_data_url"
        else True
    )
    results["drp_url"] = [rescue.drp_url for rescue in rescues]
    results["drp_repositories"] = [
        get_drp_repositories(resolver, rescue.drp_url) for rescue in rescues
    ]
    results["drp_applicable"] = is_drp_applicable(datasets["webpage"])
    return results


def get_dataset_sections(results: pd.DataFrame) -> list[dict]:
    """Builds one section per dataset, each with a row per URL, in the order they appear in the results."""

    return [
        {
            "name": name,
            "description": rows["description"].iloc[0],
            "rows": rows.drop(columns=["name", "description"]).to_dict(
                orient="records"
            ),
        }
        for name, rows in results.groupby("name", sort=False)
    ]


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
    """Renders a green "Yes" (linked to the given URL) or red "No" if there's no URL."""

    if url is None or (isinstance(url, float) and math.isnan(url)):
        return Markup("🔴 No")

    escaped_url = html.escape(str(url))
    return Markup(f'🟢 <a href="{escaped_url}" target="_blank" rel="noopener">Yes</a>')


async def get_consolidated_results() -> list[dict]:
    async with httpx.AsyncClient() as client:
        resolver = Resolver(client)

        datasets = pd.read_csv(ANALYSIS_DIR / "fire_datasets.csv")
        datasets_to_check = get_datasets_to_check(datasets)

        # webpage rows first, so they come first within each dataset's section
        results = await asyncio.gather(
            get_url_results(client, resolver, datasets, "webpage"),
            get_url_results(client, resolver, datasets_to_check, "example_data_url"),
        )

    return get_dataset_sections(pd.concat(results))


async def render_report() -> str:
    consolidated_results = await get_consolidated_results()

    env = Environment(loader=FileSystemLoader(ANALYSIS_DIR))
    env.filters["link_label"] = link_label
    env.filters["yes_no"] = yes_no
    template = env.get_template("report_template.html.jinja")
    return template.render(
        datasets=consolidated_results,
        generated_at=datetime.now(UTC),
    )
