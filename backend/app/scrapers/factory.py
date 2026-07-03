"""Scraper factory — returns the configured adapter."""
from app.core.config import settings
from app.scrapers.amazon_html import AmazonHtmlAdapter
from app.scrapers.base import ScraperAdapter
from app.scrapers.mock import MockAdapter

_ADAPTERS: dict[str, type[ScraperAdapter]] = {
    "mock": MockAdapter,
    "html": AmazonHtmlAdapter,
}


def get_scraper() -> ScraperAdapter:
    adapter_cls = _ADAPTERS.get(settings.scraper_adapter, MockAdapter)
    return adapter_cls()
