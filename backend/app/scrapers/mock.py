"""Mock scraper adapter — generates realistic, deterministic-ish product data.

Lets the entire app run end-to-end without live Amazon access or API keys.
"""
import hashlib
import random

from app.scrapers.base import ScraperAdapter, ScrapeResult


class MockAdapter(ScraperAdapter):
    name = "mock"

    async def scrape(self, asin: str) -> ScrapeResult:
        # Seed RNG from ASIN so each product has a stable baseline, with small jitter.
        seed = int(hashlib.md5(asin.encode()).hexdigest(), 16) % (10**8)
        rng = random.Random(seed)

        base_price = rng.uniform(199, 899)
        price = round(base_price + rng.uniform(-20, 20), 2)

        total = rng.randint(150, 5000)
        s5 = int(total * rng.uniform(0.55, 0.75))
        s4 = int(total * rng.uniform(0.10, 0.20))
        s3 = int(total * rng.uniform(0.04, 0.10))
        s2 = int(total * rng.uniform(0.02, 0.06))
        s1 = total - (s5 + s4 + s3 + s2)
        s1 = max(s1, 0)

        weighted = s5 * 5 + s4 * 4 + s3 * 3 + s2 * 2 + s1 * 1
        avg = round(weighted / total, 2) if total else None

        return ScrapeResult(
            asin=asin,
            product_name=f"Mock Product {asin}",
            price=price,
            currency="INR",
            total_rating_cnt=total,
            avg_rating=avg,
            star_5=s5,
            star_4=s4,
            star_3=s3,
            star_2=s2,
            star_1=s1,
            buy_box_available=rng.random() > 0.15,
            raw_payload={"source": "mock", "seed": seed},
        )
