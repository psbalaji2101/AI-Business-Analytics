"""Amazon product HTML parser.

Pure functions (no I/O) so they can be unit-tested against saved fixtures.
Selectors target amazon.in's desktop product page and degrade gracefully when
individual fields are missing.
"""
import re

from bs4 import BeautifulSoup

from app.scrapers.base import ScrapeResult

_BLOCK_MARKERS = (
    "robot check",
    "enter the characters you see below",
    "api-services-support@amazon.com",
    "to discuss automated access",
    "/errors/validatecaptcha",
)


class ScraperBlockedError(RuntimeError):
    """Raised when Amazon returns a CAPTCHA / bot-check page instead of the product."""


def is_blocked(html: str) -> bool:
    lowered = html[:5000].lower()
    return any(marker in lowered for marker in _BLOCK_MARKERS)


def _text(soup: BeautifulSoup, selector: str) -> str | None:
    el = soup.select_one(selector)
    if not el:
        return None
    return " ".join(el.get_text(" ", strip=True).split()) or None


def _parse_price(soup: BeautifulSoup) -> float | None:
    for selector in (
        "span.a-price span.a-offscreen",
        "#corePriceDisplay_desktop_feature_div .a-price-whole",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".a-price .a-price-whole",
    ):
        raw = _text(soup, selector)
        if raw:
            match = re.search(r"[\d,]+(?:\.\d+)?", raw)
            if match:
                return float(match.group().replace(",", ""))
    return None


def _parse_rating(soup: BeautifulSoup) -> float | None:
    raw = _text(soup, "#acrPopover") or _text(
        soup, "#averageCustomerReviews i.a-icon-star span.a-icon-alt"
    )
    if not raw:
        # Fallback: any "x.y out of 5" string on the page.
        raw = soup.get_text(" ", strip=True)
    match = re.search(r"(\d(?:\.\d)?)\s*out of\s*5", raw)
    if match:
        return float(match.group(1))
    match = re.match(r"\s*(\d(?:\.\d)?)", raw)
    return float(match.group(1)) if match else None


def _parse_review_count(soup: BeautifulSoup) -> int | None:
    raw = _text(soup, "#acrCustomerReviewText")
    if not raw:
        return None
    match = re.search(r"[\d,]+", raw)
    return int(match.group().replace(",", "")) if match else None


def _parse_star_percentages(soup: BeautifulSoup) -> list[int] | None:
    """Return [5★%, 4★%, 3★%, 2★%, 1★%] from the rating histogram."""
    container = soup.select_one("#histogramTable") or soup.select_one(
        "[data-hook='cr-filter-info-review-rating-count'], .cr-widget-Histogram"
    )
    if not container:
        return None
    percents = [int(p) for p in re.findall(r"(\d+)%", container.get_text(" ", strip=True))]
    return percents[:5] if len(percents) >= 5 else None


def _parse_buy_box(soup: BeautifulSoup) -> bool:
    if soup.select_one("#add-to-cart-button") or soup.select_one("#buy-now-button"):
        availability = (_text(soup, "#availability") or "").lower()
        if "unavailable" in availability or "out of stock" in availability:
            return False
        return True
    availability = (_text(soup, "#availability") or "").lower()
    return "in stock" in availability


def parse_product(html: str, asin: str) -> ScrapeResult:
    """Parse a product page into a normalized ScrapeResult.

    Raises ScraperBlockedError if the page is a CAPTCHA/bot check.
    """
    if is_blocked(html):
        raise ScraperBlockedError(f"Amazon returned a bot-check page for {asin}")

    soup = BeautifulSoup(html, "html.parser")

    total = _parse_review_count(soup)
    percents = _parse_star_percentages(soup)

    star_counts: dict[str, int | None] = {f"star_{n}": None for n in range(1, 6)}
    if percents and total:
        raw = [round(total * p / 100) for p in percents]  # [5★,4★,3★,2★,1★]
        diff = total - sum(raw)
        raw[0] += diff  # absorb rounding error into the largest bucket (5★)
        star_counts = {
            "star_5": raw[0],
            "star_4": raw[1],
            "star_3": raw[2],
            "star_2": raw[1 + 2],
            "star_1": raw[4],
        }

    return ScrapeResult(
        asin=asin,
        product_name=_text(soup, "#productTitle"),
        price=_parse_price(soup),
        currency="INR",
        total_rating_cnt=total,
        avg_rating=_parse_rating(soup),
        buy_box_available=_parse_buy_box(soup),
        raw_payload={"source": "html", "star_percentages": percents},
        **star_counts,
    )
