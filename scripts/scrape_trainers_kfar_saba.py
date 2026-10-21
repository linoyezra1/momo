"""
Google Maps scrape: מאמני כושר באור עקיבא, חריש, מנשה והישובים סביב.

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
        "query": "מאמני כושר אור עקיבא",
        "output": Path("trainers_or_akiva.csv"),
        "geolocation": {"latitude": 32.507, "longitude": 34.921},
    },
    {
        "query": "מאמני כושר חריש",
        "output": Path("trainers_harish.csv"),
        "geolocation": {"latitude": 32.460, "longitude": 35.043},
    },
    {
        "query": "מאמני כושר מועצה אזורית מנשה",
        "output": Path("trainers_menashe.csv"),
        "geolocation": {"latitude": 32.470, "longitude": 35.010},
    },
    {
        "query": "מאמני כושר אחיטוב",
        "output": Path("trainers_ahituv.csv"),
        "geolocation": {"latitude": 32.390, "longitude": 34.991},
    },
    {
        "query": "מאמני כושר עין החורש",
        "output": Path("trainers_ein_hahoresh.csv"),
        "geolocation": {"latitude": 32.389, "longitude": 34.940},
    },
    {
        "query": "מאמני כושר תלמי אלעזר",
        "output": Path("trainers_talmei_elazar.csv"),
        "geolocation": {"latitude": 32.447, "longitude": 34.975},
    },
    {
        "query": "מאמני כושר שדה יצחק",
        "output": Path("trainers_sde_yitzhak.csv"),
        "geolocation": {"latitude": 32.405, "longitude": 34.991},
    },
    {
        "query": "מאמני כושר בנימינה גבעת עדה",
        "output": Path("trainers_binyamina.csv"),
        "geolocation": {"latitude": 32.523, "longitude": 34.950},
    },
    {
        "query": "מאמני כושר בית חנניה",
        "output": Path("trainers_beit_hanania.csv"),
        "geolocation": {"latitude": 32.534, "longitude": 34.929},
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


def extract_phone(page):
    button = page.locator('button[data-item-id^="phone:tel:"]')
    if button.count():
        item_id = button.first.get_attribute("data-item-id") or ""
        raw = item_id.split("phone:tel:", 1)[-1]
        phone = unquote(raw).strip()
        if phone:
            return phone

    labeled = page.locator('button[aria-label*="טלפון"], button[aria-label*="Phone"]')
    if labeled.count():
        aria = labeled.first.get_attribute("aria-label") or ""
        for separator in (":", "："):
            if separator in aria:
                return aria.split(separator, 1)[-1].strip()
        return aria.strip()
    return ""


def extract_name(page, fallback):
    heading = page.locator("h1").first
    try:
        heading.wait_for(state="visible", timeout=12000)
        name = heading.inner_text().strip()
        if name:
            return name
    except PlaywrightTimeoutError:
        pass
    return fallback


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
