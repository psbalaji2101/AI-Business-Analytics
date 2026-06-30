"""Amazon HTML scraper adapter (httpx + BeautifulSoup).

Default scraping approach. Includes rotating user-agents, retry with exponential
backoff, proxy support, and CAPTCHA/bot-check detection. Parsing lives in `parser.py`.
"""
import asyncio
import random

import httpx

from app.core.config import settings
from app.scrapers.base import ScraperAdapter, ScrapeResult
from app.scrapers.parser import ScraperBlockedError, parse_product

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0 Safari/537.36",
]


class AmazonHtmlAdapter(ScraperAdapter):
    name = "html"

    def __init__(self) -> None:
        self.base_url = settings.amazon_base_url
        self.max_retries = settings.scraper_max_retries
        self.timeout = settings.scraper_timeout_seconds
        self.proxy = settings.scraper_proxy_url or None

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    async def _fetch(self, url: str) -> str:
        last_exc: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout,
                    proxy=self.proxy,
                    headers=self._headers(),
                    follow_redirects=True,
                ) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    return resp.text
            except Exception as exc:  # noqa: BLE001 - retry on any transport error
                last_exc = exc
                await asyncio.sleep((2**attempt) + random.uniform(0, 1))  # backoff + jitter
        raise RuntimeError(f"Failed to fetch {url} after {self.max_retries} attempts") from last_exc

    async def scrape(self, asin: str) -> ScrapeResult:
        url = f"{self.base_url}{asin}"
        html = await self._fetch(url)
        try:
            return parse_product(html, asin)
        except ScraperBlockedError:
            # One backoff + retry with a fresh UA before giving up.
            await asyncio.sleep(random.uniform(2, 5))
            html = await self._fetch(url)
            return parse_product(html, asin)
