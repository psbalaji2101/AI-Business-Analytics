"""Unit tests for the Amazon HTML parser (no network)."""
import pytest

from app.scrapers.parser import ScraperBlockedError, is_blocked, parse_product

PRODUCT_HTML = """
<html><body>
  <span id="productTitle">  Test Mobile Holder Pro  </span>
  <span class="a-price"><span class="a-offscreen">₹499.00</span></span>
  <span id="acrCustomerReviewText">1,000 ratings</span>
  <span id="acrPopover" title="4.1 out of 5 stars">4.1 out of 5 stars</span>
  <table id="histogramTable">
    <tr><td>5 star</td><td>62%</td></tr>
    <tr><td>4 star</td><td>15%</td></tr>
    <tr><td>3 star</td><td>7%</td></tr>
    <tr><td>2 star</td><td>4%</td></tr>
    <tr><td>1 star</td><td>12%</td></tr>
  </table>
  <span id="add-to-cart-button">Add to Cart</span>
  <div id="availability"><span>In stock</span></div>
</body></html>
"""

CAPTCHA_HTML = "<html><body><h4>Robot Check</h4>Enter the characters you see below</body></html>"

UNAVAILABLE_HTML = """
<html><body>
  <span id="productTitle">Gone Product</span>
  <div id="availability"><span>Currently unavailable.</span></div>
</body></html>
"""


def test_parse_core_fields():
    r = parse_product(PRODUCT_HTML, "B0TEST00001")
    assert r.product_name == "Test Mobile Holder Pro"
    assert r.price == 499.0
    assert r.avg_rating == 4.1
    assert r.total_rating_cnt == 1000


def test_parse_star_breakdown_sums_to_total():
    r = parse_product(PRODUCT_HTML, "B0TEST00001")
    assert (r.star_5, r.star_4, r.star_3, r.star_2, r.star_1) == (620, 150, 70, 40, 120)
    assert r.star_5 + r.star_4 + r.star_3 + r.star_2 + r.star_1 == r.total_rating_cnt
    assert r.positive_rating == 770  # 620 + 150
    assert r.negative_rating == 230  # 70 + 40 + 120


def test_parse_in_stock():
    assert parse_product(PRODUCT_HTML, "B0TEST00001").in_stock is True


def test_parse_out_of_stock():
    assert parse_product(UNAVAILABLE_HTML, "B0TEST00002").in_stock is False


def test_is_blocked_detects_captcha():
    assert is_blocked(CAPTCHA_HTML) is True
    assert is_blocked(PRODUCT_HTML) is False


def test_parse_raises_on_block():
    with pytest.raises(ScraperBlockedError):
        parse_product(CAPTCHA_HTML, "B0TEST00003")
