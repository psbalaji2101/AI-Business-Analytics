"""Scraper adapter interface and shared result type.

All marketplace scrapers implement `ScraperAdapter` so the rest of the app is
decoupled from any specific data source. Swap adapters via the SCRAPER_ADAPTER setting.
"""
from abc import ABC, abstractmethod

from pydantic import BaseModel


class ScrapeResult(BaseModel):
    """Normalized product data returned by every adapter."""

    asin: str
    product_name: str | None = None
    price: float | None = None
    currency: str = "INR"
    total_rating_cnt: int | None = None
    avg_rating: float | None = None
    star_5: int | None = None
    star_4: int | None = None
    star_3: int | None = None
    star_2: int | None = None
    star_1: int | None = None
    buy_box_available: bool | None = None
    raw_payload: dict | None = None

    @property
    def positive_rating(self) -> int | None:
        if self.star_5 is None or self.star_4 is None:
            return None
        return self.star_5 + self.star_4

    @property
    def negative_rating(self) -> int | None:
        if None in (self.star_3, self.star_2, self.star_1):
            return None
        return (self.star_3 or 0) + (self.star_2 or 0) + (self.star_1 or 0)

    @property
    def in_stock(self) -> bool | None:
        return self.buy_box_available


class ScraperAdapter(ABC):
    """Base class for all marketplace scrapers."""

    name: str = "base"

    @abstractmethod
    async def scrape(self, asin: str) -> ScrapeResult:
        """Fetch and normalize product data for a single ASIN."""
        raise NotImplementedError
