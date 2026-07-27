import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Contact,
  DoorOpen,
  FileSpreadsheet,
  LogIn,
  Menu,
  MessageCircle,
  RefreshCw,
  Table2,
  Wallet,
  X
} from "lucide-react";
import api from "../api";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize";
import "../landing.css";

const WHATSAPP_LINK =
  import.meta.env.VITE_MARKETING_WHATSAPP_URL ||
  "https://api.whatsapp.com/send?text=" + encodeURIComponent("שלום, אשמח לקבל פרטים על momoEVENT");

const MOMOTO_FEATURES = [
  {
    icon: RefreshCw,
    title: "הזמנה דיגיטלית שמתעדכנת באונליין",
    text: "מעצבים וליטרלי מעדכנים מתי שבא לכם. תוסיפו תמונה שלכם, את ההזמנה המעוצבת, וזהו – זה באוויר.",
    image: "/images/demo-invitation.png",
    imageAlt: "הדגמת הזמנה דיגיטלית במומו"
  },
  {
    icon: ClipboardList,
    title: "מערכת ניהול מוזמנים",
    text: "לעשות סדר בבלאגן, בלי להסתבך."
  },
  {
    icon: Contact,
    title: "ייבוא מוזמנים בלחיצת כפתור",
    text: (
      <>
        אפשר להעלות קובץ אקסל, ואפשר פשוט <strong>למשוך מאנשי הקשר בטלפון!</strong> רוצים רק לקבל
        פרופורציות ולהתחיל רשימה ראשונית? תתחילו ישר מהפלאפון.
      </>
    )
  },
  {
    icon: Wallet,
    title: "ניהול ספקים ותקציב",
    text: "מכירים את זה שיש לכם 4 הצעות מחיר מצלמים שזרוקות בווטסאפ? במקום לשמור סתם באנשי קשר, מכניסים למומו את הספקים והצעות המחיר והמערכת שומרת על הכל מסודר."
  },
  {
    icon: FileSpreadsheet,
    title: "לוג עדכונים בזמן אמת",
    text: "כי אורחים אוהבים לשנות את דעתם... המערכת מראה לכם בדיוק מי אישר, מתי, ומה הוא עדכן."
  }
];

const HOSTESS_STEPS = [
  "שמים חבר/ה או בן משפחה בכניסה עם ממשק הדיילת.",
  "מוזמן מגיע? הדיילת מחפשת אותו בשניה לפי שם או טלפון.",
  "רואים מיד באיזה שולחן הוא יושב.",
  "הוא הגיע עם פלוס אחד שלא עדכן? מושיבים אותו במקום פנוי או בשולחן רזרבה בכיף.",
  <>
    <strong>בונוס:</strong> אפשר לשלוח לאורח הודעת ווטסאפ בזמן אמת עם מספר השולחן שלו!
  </>
];

const PRICING_PLANS = [
  {
    id: "free",
    name: "החינמי",
    price: "0",
    unit: "ש״ח",
    featured: false,
    features: [
      "מערכת ניהול מוזמנים",
      "העלאה מאנשי קשר / אקסל",
      "הזמנה דיגיטלית מתעדכנת",
      "מערכת סידורי הושבה בקנבס",
      "ממשק דיילת דיגיטלית",
      "ניהול ספקים ותקציב",
      <>
        <strong>הודעות ווטסאפ ללא הגבלה (מהמספר האישי)</strong>
      </>
    ]
  },
  {
    id: "accessible",
    name: "נגיש לכל כיס",
    price: "1",
    unit: "ש״ח לרשומה",
    featured: true,
    features: [
      <>
        <strong>כל פיצ׳רי המערכת החינמית</strong>
      </>,
      "2 סבבי אישורי הגעה בווטסאפ עם כפתורים מהירים (מהחברה)",
      "2 סבבי אישורי הגעה טלפוניים אנושיים!"
    ]
  },
  {
    id: "serious",
    name: "הרציניים",
    price: "1.8",
    unit: "ש״ח לרשומה",
    featured: false,
    features: [
      <>
        <strong>כל פיצ׳רי המערכת החינמית</strong>
      </>,
      "2 סבבי ווטסאפ עם כפתורים + 2 סבבים טלפוניים אנושיים",
      "שליחת מס׳ שולחן מתוזמן בווטסאפ",
      "שליחת תזכורת ביום האירוע",
      "שליחת מס׳ שולחן בזמן אמת ע״י הדיילת (ללא הגבלה)",
      "הודעת תודה ביום למחרת"
    ]
  }
];

const initialContact = {
  fullName: "",
  phone: "",
  eventDate: "",
  message: ""
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState(initialContact);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toastVisible) return undefined;
    const timer = window.setTimeout(() => setToastVisible(false), 5200);
    return () => window.clearTimeout(timer);
  }, [toastVisible]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onContactChange = (event) => {
    const { name, value } = event.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
  };

  const onContactSubmit = async (event) => {
    event.preventDefault();
    setContactError("");
    setContactBusy(true);
    try {
      await api.post("/public/leads", {
        fullName: contactForm.fullName.trim(),
        phone: normalizeIsraeliPhone(contactForm.phone) || contactForm.phone.trim(),
        eventDate: contactForm.eventDate,
        message: contactForm.message.trim()
      });
      setContactForm(initialContact);
      setToastVisible(true);
    } catch (submitError) {
      setContactError(submitError.response?.data?.message || "שליחת הטופס נכשלה. נסו שוב בעוד רגע.");
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <div className="landing-page" dir="rtl" lang="he">
      <nav className="landing-nav" aria-label="תפריט ראשי">
        <div className="landing-nav-inner">
          <Link className="landing-nav-brand" to="/" onClick={() => setMenuOpen(false)}>
            <img src="/logo-momo.png" alt="" className="landing-nav-logo" />
            <span>momoEVENT</span>
          </Link>

          <button
            className="landing-nav-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="landing-nav-menu"
            aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div id="landing-nav-menu" className={`landing-nav-menu${menuOpen ? " is-open" : ""}`}>
            <a className="landing-nav-link" href="#what-is-momo" onClick={() => setMenuOpen(false)}>
              מה זה מומו
            </a>
            <a className="landing-nav-link" href="#seating" onClick={() => setMenuOpen(false)}>
              הושבה ודיילת
            </a>
            <a className="landing-nav-link" href="#pricing" onClick={() => setMenuOpen(false)}>
              מחירון
            </a>
            <a className="landing-nav-link" href="#contact" onClick={() => setMenuOpen(false)}>
              יצירת קשר
            </a>
            <Link
              className="landing-nav-login"
              to="/client/login"
              onClick={() => setMenuOpen(false)}
            >
              <LogIn size={16} aria-hidden="true" />
              <span className="landing-nav-login-label">התחברות ללקוחות</span>
              <span className="landing-nav-login-short" aria-hidden="true">
                כניסה
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="landing-glow landing-glow--one" aria-hidden="true" />
        <div className="landing-glow landing-glow--two" aria-hidden="true" />

        <div className="landing-hero-inner">
          <div className="landing-logo-wrap" aria-hidden="true">
            <div className="landing-logo-circle">
              <img className="landing-logo-image" src="/logo-momo.png" alt="" />
              <span className="landing-logo-text">momoEVENT</span>
            </div>
          </div>

          <h1 className="landing-title">מערכת אישורי הגעה וניהול אירוע בחינם.💍</h1>

          <div className="landing-hero-copy">
            <h2 className="landing-hero-question">איך יכול להיות שזה בחינם?</h2>
            <p className="landing-subtitle">
              כי תכל&apos;ס? ככה זה צריך להיות. כשמתחתנים ההוצאות עפות באוויר על ימין ועל שמאל, ואישורי
              הגעה זה משהו שאמור להיות נגיש לכל כיס – בלי לעשות עליכם קופה.
            </p>
          </div>

          <div className="landing-cta-row">
            <Link className="landing-cta landing-cta--primary" to="/client/login">
              מתחילים בחינם
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <a
              className="landing-cta landing-cta--secondary"
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
            >
              דברו איתנו בוואטסאפ
              <MessageCircle size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <section id="what-is-momo" className="landing-section landing-features">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">אז מה זה Momo (מומו)?</h2>
          <div className="landing-features-grid">
            {MOMOTO_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="landing-feature-card">
                  <div className="landing-feature-icon" aria-hidden="true">
                    <Icon size={22} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                  {feature.image ? (
                    <figure className="landing-media">
                      <img src={feature.image} alt={feature.imageAlt || ""} loading="lazy" />
                    </figure>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="seating" className="landing-section landing-seating">
        <div className="landing-section-inner">
          <p className="landing-section-eyebrow">
            <DoorOpen size={16} aria-hidden="true" /> סידורי הושבה
          </p>
          <h2 className="landing-section-title">סידורי הושבה והדיילת הדיגיטלית 🚪</h2>

          <div className="landing-split">
            <div className="landing-split-copy">
              <h3>
                <Table2 size={20} aria-hidden="true" /> מערכת סידורי הושבה בחינם!
              </h3>
              <p>
                מציירים את האולם שלכם בקנבס, ופשוט גוררים את המוזמנים לשולחנות. קל, ויזואלי ובלי כאבי
                ראש.
              </p>
            </div>
            <figure className="landing-media landing-media--wide">
              <img
                src="/images/seating-canvas.png"
                alt="הדגמת קנבס סידורי הושבה במומו"
                loading="lazy"
              />
            </figure>
          </div>

          <article className="landing-hostess-panel">
            <h3>הדיילת הדיגיטלית של מומו – חוסכים אלפי שקלים באולם</h3>
            <p className="landing-hostess-lead">
              חבל לשלם 1,500 ש&quot;ח לחברת סידורי הושבה בערב האירוע. איך זה עובד?
            </p>
            <ol className="landing-hostess-steps">
              {HOSTESS_STEPS.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section id="catch" className="landing-section landing-catch">
        <div className="landing-section-inner landing-catch-inner">
          <h2 className="landing-section-title">רגע, אם הכל חינם – מה הקאץ&apos;? 🤔</h2>
          <div className="landing-catch-body">
            <p>
              קודם כל – הגיע הזמן לעשות מהפכה בעולם החתונות! וברור שגם אנחנו צריכים להתפרנס, אז הנה
              האמת כמו שהיא:
            </p>
            <p>
              הווטסאפים החינמיים במערכת נשלחים <strong>ישירות מהווטסאפ האישי שלכם</strong>. נשלחת
              לאורח הזמנה אישית עם השם שלו, אבל היא יוצאת מהמספר שלכם ולא ממספר חברה אנונימי.
            </p>
            <p className="landing-catch-personal">
              <strong>ובנימה אישית:</strong>
              <br />
              בתכל&apos;ס? עדיף לשלוח לאורחים מתוך הווטסאפ שלכם. הם משקיעים, מתארגנים, שמים מעטפה, אולי
              אפילו הורידו בייביסיטר בשבילכם... לא תרביצו להם הודעה אישית מכל הלב? 😉
            </p>
            <p>
              אבל... אנחנו יודעים שלאירועים גדולים או כשאין כוח – לא לכולם זה מתאים. לכן, במידה
              ותירצו לשלוח <strong>מווטסאפ החברה בצורה כמותית</strong> (עם כפתורים מהירים שסוגרים פינה
              בשניות) או לעשות <strong>אישורי הגעה טלפוניים עם נציג אנושי</strong> – על זה יש תשלום.
            </p>
            <p>
              והכי יפה? <strong>אפס התחייבות!</strong> לא חייבים לקנות חבילות של 500 איש אם יש לכם רק
              30 אורחים לסגור. אפשר לקנות 36 רשומות, 12, או 102. בדיוק כמה שצריך.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-section landing-pricing">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">המחירון שלנו – שקוף, הוגן ובלי אותיות קטנות 💳</h2>
          <div className="landing-pricing-grid">
            {PRICING_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`landing-price-card${plan.featured ? " is-featured" : ""}`}
              >
                {plan.featured ? <span className="landing-price-tag">הכי פופולרי</span> : null}
                <h3>{plan.name}</h3>
                <div className="landing-price-amount">
                  <span className="landing-price-value">{plan.price}</span>
                  <span className="landing-price-unit">{plan.unit}</span>
                </div>
                <ul>
                  {plan.features.map((feature, index) => (
                    <li key={`${plan.id}-${index}`}>{feature}</li>
                  ))}
                </ul>
                <Link className="landing-cta landing-cta--primary landing-price-cta" to="/client/login">
                  מתחילים בחינם
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="landing-section landing-contact">
        <div className="landing-section-inner landing-contact-grid">
          <div className="landing-contact-copy">
            <p className="landing-section-eyebrow">צרו קשר</p>
            <h2 className="landing-section-title landing-section-title--start">דברו איתנו</h2>
            <p className="landing-contact-intro">
              שאלות על החבילות, על הדיילת, או סתם רוצים לוודא שזה באמת בחינם? כתבו לנו – נחזור מהר.
            </p>
            <ul className="landing-contact-bullets">
              <li>מענה מהיר מצוות momoEVENT</li>
              <li>התאמה אישית לסוג האירוע ולתקציב</li>
              <li>ליווי מקצועי עד יום האירוע</li>
            </ul>
          </div>

          <form className="landing-contact-form" onSubmit={onContactSubmit} noValidate>
            <div className="landing-field">
              <label htmlFor="contact-fullName">שם מלא</label>
              <input
                id="contact-fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={contactForm.fullName}
                onChange={onContactChange}
                placeholder="השם שלכם"
              />
            </div>
            <div className="landing-field">
              <label htmlFor="contact-phone">מספר טלפון</label>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                dir="ltr"
                value={contactForm.phone}
                onChange={onContactChange}
                placeholder="050-0000000"
              />
            </div>
            <div className="landing-field">
              <label htmlFor="contact-eventDate">
                תאריך האירוע <span className="landing-optional">(אופציונלי)</span>
              </label>
              <input
                id="contact-eventDate"
                name="eventDate"
                type="date"
                value={contactForm.eventDate}
                onChange={onContactChange}
              />
            </div>
            <div className="landing-field">
              <label htmlFor="contact-message">
                הערות / הודעה <span className="landing-optional">(אופציונלי)</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                value={contactForm.message}
                onChange={onContactChange}
                placeholder="ספרו לנו בקצרה על האירוע שלכם"
              />
            </div>

            {contactError ? (
              <p className="landing-contact-error" role="alert">
                {contactError}
              </p>
            ) : null}

            <button
              className="landing-cta landing-cta--primary landing-contact-submit"
              type="submit"
              disabled={contactBusy}
            >
              {contactBusy ? "שולחים…" : "שלחו לנו הודעה"}
            </button>
          </form>
        </div>
      </section>

      <footer className="landing-footer">
        <p>momoEVENT · מערכת אישורי הגעה וניהול אירוע בחינם</p>
        <div className="landing-footer-links">
          <Link className="landing-footer-link" to="/client/login">
            התחברות ללקוחות
          </Link>
          <a className="landing-footer-link" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
            וואטסאפ ישיר
          </a>
        </div>
      </footer>

      <div
        className={`landing-toast${toastVisible ? " is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        הודעתכם התקבלה בהצלחה! נציג ממומו איוונט יחזור אליכם בהקדם
      </div>
    </div>
  );
}
