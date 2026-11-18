"""
חיפוש מיילי אגפי/מחלקות רווחה ושירותים חברתיים ברשויות מקומיות (גוש דן + ליבה מרכזית).

גישה נגד חסימות בוט:
  1) קודם נכנסים ישירות לאתרי העיריות (פחות גוגל → פחות CAPTCHA)
  2) רק אם לא נמצא מייל — חיפוש בגוגל כגיבוי
  3) דפדפן "אנושי" יותר + המתנה ידנית כשיש CAPTCHA

Install once:
  pip install playwright
  playwright install chromium

Run:
  python scripts/scrape_welfare_dept_emails.py

Output:
  welfare_dept_emails.csv
"""

from __future__ import annotations

import csv
import random
import re
import time
from pathlib import Path
from urllib.parse import quote_plus, urlparse

from playwright.sync_api import sync_playwright

OUTPUT = Path("welfare_dept_emails.csv")
USER_DATA_DIR = Path(".playwright-welfare-profile")

MUNICIPALITIES = [
    "עיריית תל אביב-יפו",
    "עיריית בת ים",
    "עיריית חולון",
    "עיריית ראשון לציון",
    "עיריית רמת גן",
    "עיריית גבעתיים",
    "עיריית בני ברק",
    "מועצה מקומית אזור",
    "עיריית קריית אונו",
    "עיריית אור יהודה",
    "עיריית יהוד-מונוסון",
    "עיריית גבעת שמואל",
    "מועצה מקומית סביון",
    "מועצה מקומית גני תקווה",
    "עיריית פתח תקווה",
    "עיריית ראש העין",
    "עיריית אלעד",
    "עיריית הוד השרון",
    "עיריית כפר סבא",
    "עיריית רעננה",
    "עיריית הרצליה",
    "עיריית רמת השרון",
    "עיריית כפר קאסם",
    "מועצה מקומית שוהם",
    "עיריית רחובות",
    "עיריית נס ציונה",
    "עיריית יבנה",
    "עיריית לוד",
    "עיריית רמלה",
    "עיריית מודיעין-מכבים-רעות",
    "מועצה מקומית באר יעקב",
    "מועצה מקומית גדרה",
    "מועצה מקומית מזכרת בתיה",
    "מועצה מקומית קריית עקרון",
    "מועצה מקומית גן יבנה",
]

# כניסה ישירה — מפחית תלות בגוגל ובזיהוי בוט
DIRECT_START_URLS = {
    "עיריית תל אביב-יפו": [
        "https://www.tel-aviv.gov.il/Residents/HealthAndSocial/Pages/SocialServices.aspx",
        "https://www.tel-aviv.gov.il/",
    ],
    "עיריית בת ים": [
        "https://www.bat-yam.muni.il/",
        "https://www.bat-yam.muni.il/he/residents/welfare/",
    ],
    "עיריית חולון": [
        "https://www.holon.muni.il/",
        "https://www.holon.muni.il/Residents/SocialServices/Pages/default.aspx",
    ],
    "עיריית ראשון לציון": [
        "https://www.rishonlezion.muni.il/",
    ],
    "עיריית רמת גן": [
        "https://www.ramat-gan.muni.il/",
    ],
    "עיריית גבעתיים": [
        "https://www.givatayim.muni.il/",
    ],
    "עיריית בני ברק": [
        "https://www.bb-jewish.muni.il/",
        "https://www.bb.org.il/",
    ],
    "מועצה מקומית אזור": [
        "https://www.azur.muni.il/",
    ],
    "עיריית קריית אונו": [
        "https://www.kiryatono.muni.il/",
    ],
    "עיריית אור יהודה": [
        "https://www.oryehuda.muni.il/",
    ],
    "עיריית יהוד-מונוסון": [
        "https://www.yehud-monosson.muni.il/",
    ],
    "עיריית גבעת שמואל": [
        "https://www.givat-shmuel.muni.il/",
    ],
    "מועצה מקומית סביון": [
        "https://www.savyon.muni.il/",
    ],
    "מועצה מקומית גני תקווה": [
        "https://www.ganey-tikva.muni.il/",
    ],
    "עיריית פתח תקווה": [
        "https://www.petah-tikva.muni.il/",
    ],
    "עיריית ראש העין": [
        "https://www.rosh-haayin.muni.il/",
    ],
    "עיריית אלעד": [
        "https://www.elad.muni.il/",
    ],
    "עיריית הוד השרון": [
        "https://www.hod-hasharon.muni.il/",
    ],
    "עיריית כפר סבא": [
        "https://www.kfar-saba.muni.il/",
    ],
    "עיריית רעננה": [
        "https://www.raanana.muni.il/",
    ],
    "עיריית הרצליה": [
        "https://www.herzliya.muni.il/",
    ],
    "עיריית רמת השרון": [
        "https://www.ramat-hasharon.muni.il/",
    ],
    "עיריית כפר קאסם": [
        "https://www.kfar-qasem.muni.il/",
    ],
    "מועצה מקומית שוהם": [
        "https://www.shoham.muni.il/",
    ],
    "עיריית רחובות": [
        "https://www.rehovot.muni.il/",
    ],
    "עיריית נס ציונה": [
        "https://www.ness-ziona.muni.il/",
    ],
    "עיריית יבנה": [
        "https://www.yavne.muni.il/",
    ],
    "עיריית לוד": [
        "https://www.lod.muni.il/",
    ],
    "עיריית רמלה": [
        "https://www.ramla.muni.il/",
    ],
    "עיריית מודיעין-מכבים-רעות": [
        "https://www.modiin.muni.il/",
    ],
    "מועצה מקומית באר יעקב": [
        "https://www.b-y.org.il/",
    ],
    "מועצה מקומית גדרה": [
        "https://www.gedera.muni.il/",
    ],
    "מועצה מקומית מזכרת בתיה": [
        "https://www.mazkeret-batya.muni.il/",
    ],
    "מועצה מקומית קריית עקרון": [
        "https://www.qiryat-eqron.muni.il/",
    ],
    "מועצה מקומית גן יבנה": [
        "https://www.ganyavne.muni.il/",
    ],
}

WELFARE_TERMS = [
    "מנהל הרווחה והשירותים החברתיים",
    "אגף הרווחה",
    "מחלקת הרווחה",
    "השירותים החברתיים",
    "אגף לשירותים חברתיים",
    "מחלקה לשירותים חברתיים",
    "מינהל הרווחה",
    "רווחה",
]

EMAIL_RE = re.compile(
    r"(?<![A-Za-z0-9._%+\-])([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})(?![A-Za-z0-9._%+\-])"
)

PREFERRED_DOMAIN_HINTS = (
    ".muni.il",
    ".gov.il",
    "tel-aviv.gov.il",
    "tlv.gov.il",
)

WELFARE_EMAIL_HINTS = (
    "revaha",
    "welfare",
    "social",
    "shikul",
    "shikum",
    "rova",
    "רווחה",
)

WELFARE_PATH_HINTS = (
    "revaha",
    "welfare",
    "social",
    "רווחה",
    "שירותים-חברתיים",
    "socialservices",
)


def pause(page, low=1.2, high=2.8):
    page.wait_for_timeout(int(random.uniform(low, high) * 1000))


def human_pause(page, low=2.5, high=5.5):
    """השהייה ארוכה יותר בין רשויות — פחות נראה כמו בוט."""
    page.wait_for_timeout(int(random.uniform(low, high) * 1000))


def dismiss_consent(page):
    labels = ["קבל הכול", "אישור הכול", "אני מסכים", "Accept all", "I agree", "Reject all", "דחה הכל"]
    for label in labels:
        button = page.get_by_role("button", name=label)
        try:
            if button.count():
                button.first.click(timeout=1500)
                pause(page, 0.4, 0.8)
                return
        except Exception:
            continue


def is_blocked_page(page) -> bool:
    try:
        text = (page.locator("body").inner_text(timeout=3000) or "").lower()
    except Exception:
        text = ""
    markers = (
        "unusual traffic",
        "captcha",
        "recaptcha",
        "לא רובוט",
        "verify you are human",
        "are you a robot",
        "access denied",
        "cf-browser-verification",
        "just a moment",
        "attention required",
    )
    return any(m in text for m in markers)


def wait_for_manual_unblock(page, label: str = "חסימה/CAPTCHA"):
    """
    כשאתר מזהה בוט — מחכים שתפתור ידנית בחלון הדפדפן.
    Enter בטרמינל = המשך.
    """
    print(f"\n  ⚠ זוהתה {label}.")
    print("  פתרי בחלון הדפדפן, ואז לחצי Enter כאן כדי להמשיך...")
    try:
        input()
    except EOFError:
        # ריצה לא-אינטראקטיבית — השהייה ארוכה במקום
        pause(page, 20.0, 30.0)


def clean_email(raw: str) -> str:
    email = str(raw or "").strip().strip(".,;:()[]<>\"'").lower()
    email = email.replace("%20", "").replace(" ", "")
    if email.endswith(".") or "@" not in email:
        return ""
    if any(x in email for x in ("example.com", "sentry.io", "wixpress", "schema.org", "png", "jpg", "css")):
        return ""
    local, _, domain = email.partition("@")
    if not local or not domain or "." not in domain:
        return ""
    return email


def score_email(email: str, page_text: str = "") -> int:
    score = 0
    e = email.lower()
    text = (page_text or "").lower()
    if any(h in e for h in WELFARE_EMAIL_HINTS):
        score += 50
    if e.endswith(".muni.il") or ".muni.il" in e:
        score += 40
    if e.endswith(".gov.il") or ".gov.il" in e:
        score += 30
    if any(h in e for h in PREFERRED_DOMAIN_HINTS):
        score += 20
    idx = text.find(e)
    if idx >= 0:
        window = text[max(0, idx - 220) : idx + 220]
        if any(term.lower() in window for term in WELFARE_TERMS):
            score += 35
        if "רווחה" in window or "שירותים חברתיים" in window:
            score += 25
    if e.startswith("info@") or e.startswith("webmaster@"):
        score -= 10
    return score


def extract_emails_from_text(text: str) -> list[str]:
    found = []
    for match in EMAIL_RE.finditer(text or ""):
        email = clean_email(match.group(1))
        if email and email not in found:
            found.append(email)
    return found


def build_search_queries(municipality: str) -> list[str]:
    short = municipality.replace("עיריית ", "").replace("מועצה מקומית ", "").strip()
    return [
        f'{municipality} "אגף הרווחה" OR "מחלקת הרווחה" OR "השירותים החברתיים" מייל OR email',
        f'{short} מחלקת רווחה @muni.il',
        f'{short} "מנהל הרווחה והשירותים החברתיים" דוא"ל',
    ]


def google_search_url(query: str) -> str:
    return f"https://www.google.co.il/search?hl=he&q={quote_plus(query)}&num=10"


def collect_result_links(page, limit: int = 8) -> list[str]:
    links: list[str] = []
    selectors = [
        "a[href^='http']:has(h3)",
        "#search a[href^='http']",
        "a[jsname][href^='http']",
    ]
    for selector in selectors:
        anchors = page.locator(selector)
        count = min(anchors.count(), 20)
        for i in range(count):
            href = anchors.nth(i).get_attribute("href") or ""
            if not href.startswith("http"):
                continue
            host = urlparse(href).netloc.lower()
            if any(bad in host for bad in ("google.", "gstatic.", "youtube.", "webcache.")):
                continue
            if href not in links:
                links.append(href)
            if len(links) >= limit:
                return links
    return links


def collect_welfare_internal_links(page, base_url: str, limit: int = 8) -> list[str]:
    """קישורים פנימיים שנראים כמו עמודי רווחה."""
    links: list[str] = []
    try:
        anchors = page.locator("a[href]")
        count = min(anchors.count(), 120)
        for i in range(count):
            href = anchors.nth(i).get_attribute("href") or ""
            text = (anchors.nth(i).inner_text(timeout=500) or "").strip()
            if not href or href.startswith(("mailto:", "tel:", "javascript:")):
                continue
            full = page.evaluate("(h) => new URL(h, location.href).href", href)
            blob = f"{full} {text}".lower()
            if any(h in blob for h in WELFARE_PATH_HINTS) or any(t in text for t in WELFARE_TERMS):
                if full not in links and urlparse(full).netloc == urlparse(base_url).netloc:
                    links.append(full)
            if len(links) >= limit:
                break
    except Exception:
        pass
    return links


def goto_with_retry(page, url: str, attempts: int = 2, allow_manual: bool = True) -> bool:
    for attempt in range(1, attempts + 1):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            pause(page, 1.2, 2.4)
            dismiss_consent(page)
            if is_blocked_page(page):
                if allow_manual:
                    wait_for_manual_unblock(page)
                    dismiss_consent(page)
                    if is_blocked_page(page):
                        print("  עדיין חסום — מדלג")
                        return False
                else:
                    return False
            return True
        except Exception as error:
            print(f"  ניווט נכשל ({attempt}/{attempts}): {error}")
            pause(page, 2.0, 4.0)
    return False


def harvest_page_emails(page, url: str) -> tuple[list[str], str]:
    try:
        title = page.title()
    except Exception:
        title = ""
    try:
        text = page.locator("body").inner_text(timeout=8000)
    except Exception:
        text = ""
    html = ""
    try:
        html = page.content()
    except Exception:
        pass

    emails = extract_emails_from_text(text)
    for email in extract_emails_from_text(html):
        if email not in emails:
            emails.append(email)

    try:
        mailtos = page.locator('a[href^="mailto:"]')
        for i in range(min(mailtos.count(), 20)):
            href = mailtos.nth(i).get_attribute("href") or ""
            email = clean_email(href.replace("mailto:", "").split("?")[0])
            if email and email not in emails:
                emails.append(email)
    except Exception:
        pass

    return emails, title or url


def pick_best_emails(candidates: list[dict], max_keep: int = 3) -> list[dict]:
    ranked = sorted(candidates, key=lambda row: row["score"], reverse=True)
    seen = set()
    best = []
    for row in ranked:
        email = row["email"]
        if email in seen:
            continue
        seen.add(email)
        best.append(row)
        if len(best) >= max_keep:
            break
    return best


def add_candidate(candidates: list[dict], municipality: str, email: str, source: str, title: str, page_text: str):
    score = score_email(email, page_text)
    if score < 15 and not any(h in email for h in (".muni.il", ".gov.il")):
        return
    candidates.append(
        {
            "municipality": municipality,
            "email": email,
            "score": score,
            "source": source,
            "page_title": title[:180],
        }
    )
    print(f"     מייל: {email} (score={score})")


def scrape_direct_site(page, municipality: str, candidates: list[dict], visited: set[str]):
    urls = DIRECT_START_URLS.get(municipality, [])
    for start in urls:
        print(f"  ישיר: {start}")
        if not goto_with_retry(page, start):
            continue
        visited.add(start)
        emails, title = harvest_page_emails(page, start)
        page_text = ""
        try:
            page_text = page.locator("body").inner_text(timeout=5000)
        except Exception:
            page_text = title
        for email in emails:
            add_candidate(candidates, municipality, email, start, title, page_text)

        # קישורים פנימיים לעמודי רווחה
        for link in collect_welfare_internal_links(page, start, limit=6):
            if link in visited:
                continue
            visited.add(link)
            print(f"  → עמוד רווחה: {link}")
            if not goto_with_retry(page, link, attempts=1):
                continue
            emails, title = harvest_page_emails(page, link)
            try:
                page_text = page.locator("body").inner_text(timeout=5000)
            except Exception:
                page_text = title
            for email in emails:
                add_candidate(candidates, municipality, email, link, title, page_text)
            pause(page, 1.0, 2.0)


def scrape_via_google(page, municipality: str, candidates: list[dict], visited: set[str]):
    for query in build_search_queries(municipality):
        # אם כבר יש מייל טוב — לא חייבים להמשיך לגוגל
        if any(c["score"] >= 60 for c in candidates):
            print("  יש מייל חזק — מדלג על גוגל")
            return

        print(f"  חיפוש גוגל: {query}")
        if not goto_with_retry(page, google_search_url(query)):
            continue

        links = collect_result_links(page, limit=5)
        print(f"  נמצאו {len(links)} קישורים")

        for link in links:
            if link in visited:
                continue
            visited.add(link)
            print(f"  → {link}")
            if not goto_with_retry(page, link, attempts=1):
                continue
            emails, title = harvest_page_emails(page, link)
            try:
                page_text = page.locator("body").inner_text(timeout=5000)
            except Exception:
                page_text = title
            for email in emails:
                add_candidate(candidates, municipality, email, link, title, page_text)
            pause(page, 1.2, 2.5)

        human_pause(page, 3.0, 6.0)


def search_municipality(page, municipality: str) -> list[dict]:
    print(f"\n=== {municipality} ===")
    candidates: list[dict] = []
    visited: set[str] = set()

    scrape_direct_site(page, municipality, candidates, visited)
    if not any(c["score"] >= 40 for c in candidates):
        scrape_via_google(page, municipality, candidates, visited)
    else:
        print("  נמצא מייל מהאתר הישיר — גוגל רק אם צריך")

    return pick_best_emails(candidates, max_keep=3)


def save_csv(path: Path, rows: list[dict]):
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["רשות", "מייל", "ציון", "כותרת_עמוד", "מקור"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "רשות": row.get("municipality", ""),
                    "מייל": row.get("email", ""),
                    "ציון": row.get("score", ""),
                    "כותרת_עמוד": row.get("page_title", ""),
                    "מקור": row.get("source", ""),
                }
            )
    print(f"\nנשמרו {len(rows)} שורות אל {path.resolve()}")


def apply_stealth(context):
    """מסתיר סימני אוטומציה בסיסיים שאתרים בודקים."""
    context.add_init_script(
        """
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = window.chrome || { runtime: {} };
        Object.defineProperty(navigator, 'languages', { get: () => ['he-IL', 'he', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """
    )


def scrape():
    all_rows: list[dict] = []
    USER_DATA_DIR.mkdir(exist_ok=True)

    with sync_playwright() as playwright:
        # פרופיל קבוע = קוקיז/סשן אמיתי יותר (פחות CAPTCHA חוזר)
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            headless=False,
            locale="he-IL",
            viewport={"width": 1400, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            args=["--disable-blink-features=AutomationControlled"],
        )
        apply_stealth(context)
        page = context.pages[0] if context.pages else context.new_page()
        page.set_default_navigation_timeout(45000)

        print("טיפ: אם מופיע CAPTCHA — פתרי בחלון ולחצי Enter בטרמינל.")
        print("רוב העבודה עכשיו מאתרי העיריות ישירות, בלי גוגל.\n")

        for municipality in MUNICIPALITIES:
            try:
                best = search_municipality(page, municipality)
                if best:
                    all_rows.extend(best)
                else:
                    all_rows.append(
                        {
                            "municipality": municipality,
                            "email": "",
                            "score": 0,
                            "page_title": "",
                            "source": "",
                        }
                    )
                    print("  לא נמצא מייל")
            except Exception as error:
                print(f"  שגיאה עבור {municipality}: {error}")
                all_rows.append(
                    {
                        "municipality": municipality,
                        "email": "",
                        "score": 0,
                        "page_title": f"ERROR: {error}",
                        "source": "",
                    }
                )
            save_csv(OUTPUT, all_rows)
            human_pause(page, 3.0, 7.0)

        context.close()

    save_csv(OUTPUT, all_rows)


if __name__ == "__main__":
    random.seed(time.time())
    scrape()
