"""
Google Maps scrape: מאמני כושר בבת ים.

Install once:
  pip install playwright
  playwright install chromium

Run:
  python scripts/scrape_trainers_kfar_saba.py
"""

import csv
import random
import time
from pathlib import Path
from urllib.parse import unquote, urljoin

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

SEARCHES = [
    {
        "query": "מאמני כושר בת ים",
        "output": Path("trainers_bat_yam.csv"),
        "geolocation": {"latitude": 32.017, "longitude": 34.750},
    },
]


def pause(page, low=1.0, high=2.0):
    page.wait_for_timeout(int(random.uniform(low, high) * 1000))


def dismiss_consent(page):
    labels = ["קבל הכול", "אישור הכול", "אני מסכים", "Accept all", "I agree"]
    for label in labels:
        button = page.get_by_role("button", name=label)
        try:
            if button.count():
                button.first.click(timeout=2000)
                pause(page)
                return
        except PlaywrightTimeoutError:
            continue


def collect_place_links(page):
    feed = page.locator('div[role="feed"]')
    try:
        feed.wait_for(state="visible", timeout=7000)
    except Exception:
        print("לא נמצאה רשימת תוצאות עבור החיפוש, מדלג...")
        return {}
    places = {}
    stale_rounds = 0

    while stale_rounds < 4:
        before = len(places)
        anchors = page.locator('div[role="feed"] a[href*="/maps/place"]')
        count = anchors.count()
        for index in range(count):
            anchor = anchors.nth(index)
            href = anchor.get_attribute("href") or ""
            if not href or href in places:
                continue
            label = (anchor.get_attribute("aria-label") or "").strip()
            places[href] = label

        at_end = page.get_by_text("הגעת לסוף הרשימה").count() or page.get_by_text(
            "You've reached the end of the list"
        ).count()
        feed.evaluate("(el) => el.scrollBy(0, Math.max(el.clientHeight * 0.8, 400))")
        pause(page)
        if at_end or len(places) == before:
            stale_rounds += 1
        else:
            stale_rounds = 0

    return places


def looks_like_phone(value):
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return 8 <= len(digits) <= 15


def extract_phone(page):
    button = page.locator('button[data-item-id^="phone:tel:"]')
    if button.count():
        item_id = button.first.get_attribute("data-item-id") or ""
        raw = item_id.split("phone:tel:", 1)[-1]
        phone = unquote(raw).strip()
        if looks_like_phone(phone):
            return phone

    labeled = page.locator('button[aria-label*="טלפון"], button[aria-label*="Phone"]')
    if labeled.count():
        aria = labeled.first.get_attribute("aria-label") or ""
        for separator in (":", "："):
            if separator in aria:
                phone = aria.split(separator, 1)[-1].strip()
                if looks_like_phone(phone):
                    return phone
        if looks_like_phone(aria):
            return aria.strip()
    return ""


def name_from_maps_url(url):
    try:
        marker = "/maps/place/"
        if marker not in url:
            return ""
        slug = url.split(marker, 1)[1].split("/", 1)[0]
        name = unquote(slug).replace("+", " ").strip()
        name = name.replace("\u200f", "").replace("\u200e", "").strip(" ·|-")
        if name in {"תוצאות", "Results", "Search results"}:
            return ""
        return name
    except Exception:
        return ""


def extract_name(page, fallback):
    heading = page.locator("h1").first
    try:
        heading.wait_for(state="visible", timeout=12000)
        name = heading.inner_text().strip()
        if name and name not in {"תוצאות", "Results", "Search results"}:
            return name
    except PlaywrightTimeoutError:
        pass
    from_url = name_from_maps_url(page.url)
    if from_url:
        return from_url
    if fallback and fallback not in {"תוצאות", "Results"}:
        return fallback
    return from_url or fallback or ""


def css_attr_fragment(value):
    # Keep a stable slice of the place URL that is safe inside a CSS attribute selector.
    fragment = value
    if "/maps/place/" in fragment:
        fragment = fragment.split("/maps/place/", 1)[1]
    fragment = fragment.split("?", 1)[0].split("&", 1)[0]
    return fragment.replace("\\", "\\\\").replace('"', '\\"')[:180]


def open_place_card(page, href):
    fragment = css_attr_fragment(href)
    card = page.locator(f'a[href*="{fragment}"]')
    if fragment and card.count():
        try:
            card.first.scroll_into_view_if_needed(timeout=5000)
            card.first.click(timeout=8000)
            return True
        except PlaywrightTimeoutError:
            pass
    try:
        page.goto(
            urljoin("https://www.google.com", href),
            wait_until="domcontentloaded",
            timeout=15000,
        )
        return True
    except Exception as error:
        print(f"שגיאה בטעינת כרטיס עסק, מדלג: {error}")
        return False


def search_url(query):
    return "https://www.google.com/maps/search/" + query.replace(" ", "+")


def save_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["שם", "טלפון", "קישור"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"נשמרו {len(rows)} שורות אל {path.resolve()}")


def scrape_query(page, context, search):
    print(f"מתחיל: {search['query']}")
    context.set_geolocation(search["geolocation"])
    page.goto(search_url(search["query"]), wait_until="domcontentloaded")
    pause(page)
    dismiss_consent(page)
    places = collect_place_links(page)
    print(f"נמצאו {len(places)} עסקים")
    rows = []

    for href, fallback_name in places.items():
        try:
            if not open_place_card(page, href):
                rows.append(
                    {
                        "שם": fallback_name,
                        "טלפון": "",
                        "קישור": urljoin("https://www.google.com", href),
                    }
                )
                pause(page)
                continue
            page.locator("h1").first.wait_for(state="visible", timeout=12000)
            pause(page)
            name = extract_name(page, fallback_name)
            phone = extract_phone(page)
            link = page.url
            rows.append({"שם": name, "טלפון": phone, "קישור": link})
            print(f"{name} | {phone or '—'}")
        except PlaywrightTimeoutError:
            rows.append(
                {
                    "שם": fallback_name,
                    "טלפון": "",
                    "קישור": urljoin("https://www.google.com", href),
                }
            )
            print(f"דילוג אחרי timeout: {fallback_name or href}")
        pause(page)

    save_csv(search["output"], rows)
    return rows


def scrape():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        context = browser.new_context(
            locale="he-IL",
            viewport={"width": 1400, "height": 900},
            geolocation=SEARCHES[0]["geolocation"],
            permissions=["geolocation"],
        )
        page = context.new_page()
        for search in SEARCHES:
            scrape_query(page, context, search)
        context.close()
        browser.close()


if __name__ == "__main__":
    random.seed(time.time())
    scrape()
