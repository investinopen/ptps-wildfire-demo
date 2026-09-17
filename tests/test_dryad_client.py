import pytest
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo.dryad_client import DryadClient

DOI = "10.5061/dryad.63xsj3vd4"


def mock_token(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://datadryad.org/oauth/token",
        json={"access_token": "test-token", "token_type": "Bearer"},
    )


def test_get_token(httpx_mock: HTTPXMock):
    mock_token(httpx_mock)

    client = DryadClient("id", "secret")

    assert client.token == "test-token"


def test_resolve_download_url(httpx_mock: HTTPXMock):
    mock_token(httpx_mock)
    httpx_mock.add_response(
        url=f"https://datadryad.org/api/v2/datasets/{DOI.replace('/', '%2F')}",
        json={"_links": {"stash:version": {"href": "/api/v2/versions/458442"}}},
    )
    httpx_mock.add_response(
        url="https://datadryad.org/api/v2/versions/458442/files",
        json={
            "_embedded": {
                "stash:files": [
                    {
                        "path": "fire_maps.zip",
                        "_links": {
                            "stash:download": {"href": "/api/v2/files/4917548/download"}
                        },
                    }
                ]
            }
        },
    )
    httpx_mock.add_response(
        url="https://datadryad.org/api/v2/files/4917548/download",
        headers={"Location": "https://example-bucket.s3.amazonaws.com/fire_maps.zip"},
        status_code=302,
    )
    httpx_mock.add_response(
        url="https://example-bucket.s3.amazonaws.com/fire_maps.zip",
    )

    client = DryadClient("id", "secret")
    url = client.resolve_download_url(DOI, "fire_maps.zip")

    assert url == "https://example-bucket.s3.amazonaws.com/fire_maps.zip"


def test_resolve_download_url_file_not_found(httpx_mock: HTTPXMock):
    mock_token(httpx_mock)
    httpx_mock.add_response(
        url=f"https://datadryad.org/api/v2/datasets/{DOI.replace('/', '%2F')}",
        json={"_links": {"stash:version": {"href": "/api/v2/versions/458442"}}},
    )
    httpx_mock.add_response(
        url="https://datadryad.org/api/v2/versions/458442/files",
        json={"_embedded": {"stash:files": [{"path": "README.md", "_links": {}}]}},
    )

    client = DryadClient("id", "secret")

    with pytest.raises(ValueError, match="not found"):
        client.resolve_download_url(DOI, "fire_maps.zip")
