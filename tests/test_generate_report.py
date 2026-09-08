from datetime import UTC, datetime

from jinja2 import Environment, FileSystemLoader

from analysis.generate_report import ANALYSIS_DIR, link_label, yes_no


def test_report_template_renders_common_crawl_column():
    env = Environment(loader=FileSystemLoader(ANALYSIS_DIR))
    env.filters["link_label"] = link_label
    env.filters["yes_no"] = yes_no
    template = env.get_template("report_template.html.jinja")

    html = template.render(
        datasets=[
            {
                "name": "Example dataset",
                "description": "Example description",
                "rows": [
                    {
                        "type": "Webpage",
                        "url": "https://example.com/",
                        "status": "🟢 200",
                        "wayback_url": None,
                        "wayback_applicable": True,
                        "common_crawl_url": "https://index.commoncrawl.org/CC-MAIN-2026-10/20260202020202/https://example.com/",
                        "common_crawl_applicable": True,
                        "drp_url": None,
                        "drp_applicable": True,
                    }
                ],
            }
        ],
        generated_at=datetime(2026, 1, 1, tzinfo=UTC),
    )

    assert "Common Crawl" in html
    assert (
        'href="https://index.commoncrawl.org/CC-MAIN-2026-10/20260202020202/https://example.com/"'
        in html
    )
