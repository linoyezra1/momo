"""
Google Maps scrape: מדריך ירי.

Install once:
  pip install playwright
  playwright install chromium

Run:
  python scripts/scrape_shooting_instructors.py
"""

import csv
import random
import re
import time
from pathlib import Path
from urllib.parse import quote, unquote, urljoin

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# Israeli landline / mobile, with optional +972 and separators.
PHONE_RE = re.compile(
    r"(?:\+972[\s\-]?(?:\d[\s\-]?){8,9}|0(?:5\d|[2-489]|7[2-9])[\s\-]?(?:\d[\s\-]?){6,8})"
)

SEARCHES = [
    {
        "query": "מדריך ירי",
        "output": Path("shooting_instructors.csv"),
        "geolocation": {"latitude": 32.085, "longitude": 34.782},
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
        feed.wait_for(state="visible", timeout=20000)
    except Exception:
        # Sometimes results render without role=feed for a bit — retry once after pause.
        pause(page, 2.0, 3.5)
        try:
            feed.wait_for(state="visible", timeout=12000)
        except Exception:
            print("לא נמצאה רשימת תוצאות עבור החיפוש, מדלג...")
            return {}
    places = {}
    stale_rounds = 0

    while stale_rounds < 6:
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


def digits_only(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def looks_like_phone(value):
    digits = digits_only(value)
    if digits.startswith("972"):
        digits = "0" + digits[3:]
    return 9 <= len(digits) <= 12


def normalize_phone(value):
    raw = unquote(str(value or "")).strip()
    raw = raw.replace("\u200f", "").replace("\u200e", "").replace("\xa0", " ")
    if raw.lower().startswith("tel:"):
        raw = raw[4:]
    digits = digits_only(raw)
    if digits.startswith("972") and len(digits) >= 11:
        return "0" + digits[3:]
    if digits.startswith("0") and looks_like_phone(digits):
        return digits
    if looks_like_phone(raw):
        return digits if digits.startswith("0") else raw
    return ""


def phone_from_text(value):
    text = str(value or "")
    match = PHONE_RE.search(text)
    if not match:
        return ""
    return normalize_phone(match.group(0))


def try_reveal_phone(page):
    labels = [
        "העתק את מספר הטלפון",
        "העתק מספר טלפון",
        "הצג מספר טלפון",
        "התקשר",
        "Copy phone number",
        "Show phone number",
        "Call",
    ]
    for label in labels:
        button = page.get_by_role("button", name=re.compile(label, re.I))
        try:
            if button.count():
                button.first.click(timeout=1500)
                pause(page, 0.4, 0.8)
                return
        except Exception:
            continue


def scroll_place_details(page):
    for selector in ('div[role="main"]', 'div[role="region"]'):
        panel = page.locator(selector).first
        try:
            if panel.count():
                panel.evaluate("(el) => el.scrollBy(0, 500)")
                pause(page, 0.4, 0.9)
                return
        except Exception:
            continue


def extract_phone_from_html(html):
    """Parse phone out of raw HTML — more reliable than visible locators on Maps."""
    patterns = [
        r'data-item-id="phone:tel:([^"]+)"',
        r"data-item-id='phone:tel:([^']+)'",
        r'data-item-id="phone:([^"]+)"',
        r'href="tel:([^"]+)"',
        r"href='tel:([^']+)'",
        r'aria-label="(?:טלפון|Phone|התקשר אל|Call)[^"]*?([0-9+\-\s]{8,})"',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, html or "", re.I):
            phone = normalize_phone(unquote(match.group(1)))
            if phone:
                return phone
    return phone_from_text(html or "")


def extract_phone(page):
    scroll_place_details(page)
    try_reveal_phone(page)
    pause(page, 0.5, 1.0)

    # 0) Raw HTML first — Maps often keeps tel: in DOM even if button not "visible"
    try:
        phone = extract_phone_from_html(page.content())
        if phone:
            return phone
    except Exception:
        pass

    # 1) Direct tel: links
    tel_links = page.locator('a[href^="tel:"], [href^="tel:"]')
    for index in range(min(tel_links.count(), 8)):
        href = tel_links.nth(index).get_attribute("href") or ""
        phone = normalize_phone(href)
        if phone:
            return phone

    # 2) Classic Maps phone action buttons
    phone_buttons = page.locator(
        'button[data-item-id^="phone:tel:"], button[data-item-id*="phone:tel:"], '
        '[data-item-id^="phone:tel:"], [data-item-id*="phone"]'
    )
    for index in range(min(phone_buttons.count(), 8)):
        button = phone_buttons.nth(index)
        item_id = button.get_attribute("data-item-id") or ""
        if "tel:" in item_id:
            phone = normalize_phone(item_id.split("tel:", 1)[-1])
            if phone:
                return phone
        for attr in ("aria-label", "data-tooltip", "title"):
            phone = phone_from_text(button.get_attribute(attr) or "")
            if phone:
                return phone
        try:
            phone = phone_from_text(button.inner_text())
            if phone:
                return phone
        except Exception:
            pass

    # 3) Aria / tooltip anywhere in the place card
    labeled = page.locator(
        '[aria-label*="טלפון"], [aria-label*="Phone"], [aria-label*="התקשר"], '
        '[data-tooltip*="טלפון"], [data-tooltip*="Phone"]'
    )
    for index in range(min(labeled.count(), 10)):
        node = labeled.nth(index)
        for attr in ("aria-label", "data-tooltip", "data-item-id", "href", "title"):
            phone = phone_from_text(node.get_attribute(attr) or "")
            if phone:
                return phone

    # 4) Regex over the visible place panel text
    for selector in ('div[role="main"]', "body"):
        try:
            text = page.locator(selector).first.inner_text(timeout=2500)
            phone = phone_from_text(text)
            if phone:
                return phone
        except Exception:
            continue

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
    fragment = value
    if "/maps/place/" in fragment:
        fragment = fragment.split("/maps/place/", 1)[1]
    fragment = fragment.split("?", 1)[0].split("&", 1)[0]
    return fragment.replace("\\", "\\\\").replace('"', '\\"')[:180]


def goto_with_retry(page, url, attempts=3, timeout_ms=90000):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            # "commit" is more reliable than domcontentloaded on heavy Maps pages.
            page.goto(url, wait_until="commit", timeout=timeout_ms)
            pause(page, 2.0, 3.5)
            dismiss_consent(page)
            return True
        except Exception as error:
            last_error = error
            print(f"ניווט נכשל ({attempt}/{attempts}): {error}")
            pause(page, 2.0, 4.0)
    print(f"ויתור אחרי {attempts} ניסיונות: {url}")
    if last_error:
        print(str(last_error))
    return False


def open_place_card(page, href):
    absolute = urljoin("https://www.google.co.il", href)
    if goto_with_retry(page, absolute, attempts=2, timeout_ms=90000):
        return True

    fragment = css_attr_fragment(href)
    card = page.locator(f'a[href*="{fragment}"]')
    if fragment and card.count():
        try:
            card.first.scroll_into_view_if_needed(timeout=5000)
            card.first.click(timeout=8000)
            pause(page, 1.5, 2.5)
            dismiss_consent(page)
            return True
        except PlaywrightTimeoutError:
            pass
    print(f"שגיאה בטעינת כרטיס עסק, מדלג: {href}")
    return False


def search_url(query):
    encoded = quote(query).replace("%20", "+")
    return f"https://www.google.co.il/maps/search/{encoded}?hl=he"


def save_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["שם", "טלפון", "קישור"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"נשמרו {len(rows)} שורות אל {path.resolve()}")


def scrape_query(page, context, search):
    print(f"מתחיל: {search['query']}")
    context.set_geolocation(search["geolocation"])
    if not goto_with_retry(page, search_url(search["query"]), attempts=3, timeout_ms=90000):
        print("לא הצלחתי לפתוח את עמוד החיפוש — מדלג על השאילתה הזו")
        save_csv(search["output"], [])
        return []

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
                        "קישור": urljoin("https://www.google.co.il", href),
                    }
                )
                save_csv(search["output"], rows)
                pause(page)
                continue
            page.locator("h1").first.wait_for(state="visible", timeout=20000)
            pause(page, 1.5, 2.5)
            try:
                page.wait_for_selector(
                    'a[href^="tel:"], button[data-item-id*="phone"], [aria-label*="טלפון"], [aria-label*="Phone"]',
                    timeout=8000,
                )
            except PlaywrightTimeoutError:
                pass
            name = extract_name(page, fallback_name)
            phone = extract_phone(page)
            if not phone:
                pause(page, 1.5, 2.5)
                phone = extract_phone(page)
            link = page.url
            rows.append({"שם": name, "טלפון": phone, "קישור": link})
            print(f"{name} | {phone or '—'}")
            save_csv(search["output"], rows)
        except PlaywrightTimeoutError:
            rows.append(
                {
                    "שם": fallback_name,
                    "טלפון": "",
                    "קישור": urljoin("https://www.google.co.il", href),
                }
            )
            save_csv(search["output"], rows)
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
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        page.set_default_navigation_timeout(90000)
        page.set_default_timeout(30000)
        for search in SEARCHES:
            scrape_query(page, context, search)
        context.close()
        browser.close()


if __name__ == "__main__":
    random.seed(time.time())
    scrape()
