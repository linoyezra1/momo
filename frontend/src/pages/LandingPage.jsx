import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Gift,
  LogIn,
  Menu,
  MessageCircle,
  Quote,
  Sparkles,
  Users,
  X
} from "lucide-react";
import api from "../api";
import { normalizeIsraeliPhone } from "../utils/phoneNormalize";
import "../landing.css";

const WHATSAPP_LINK =
  import.meta.env.VITE_MARKETING_WHATSAPP_URL ||
  "https://api.whatsapp.com/send?text=" + encodeURIComponent("שלום, אשמח לקבל פרטים על momoEVENT");

const FEATURES = [
  {
    icon: Sparkles,
    title: "הזמנה דיגיטלית מעוצבת",
    text: "יצירת הזמנה מהממת עם אפשרות עריכה עצמאית של פרטי האירוע, התאריכים והמיקום בכל רגע."
  },
  {
    icon: BarChart3,
    title: "אישורי הגעה בזמן אמת",
    text: "מעקב אונליין מלא עם סטטוס מגיעים / לא מגיעים / אולי המתעדכן אצלכם במסך בשניות אמת."
  },
  {
    icon: Users,
    title: "ניהול רשימות חכם",
    text: "ייבוא קל ומהיר מקובץ Excel, אפשרות להוספה ידנית ומנגנון אוטומטי למניעת כפילויות לפי מספר טלפון."
  },
  {
    icon: Gift,
    title: "מעקב תשלומים ומתנות",
    text: "רישום ומעקב מסודר אחר המתנות והכספים שקיבלתם באירוע, כדי ששום דבר לא ילך לאיבוד."
  },
  {
    icon: MessageCircle,
    title: "שליחה בוואטסאפ ללא הגבלה",
    text: "פיצ'ר ייחודי לשליחת הזמנות ותזכורות ישירות מהמספר האישי שלכם ללא הגבלת כמות."
  }
];

const TESTIMONIALS = [
  {
    quote:
      "סוף סוף עשינו סדר במוזמנים בלי אקסלים אינסופיים. ההזמנה יצאה מדהימה ואישורי ההגעה זרמו אלינו בזמן אמת.",
    names: "לינוי ודן",
    meta: "אולם עדיה | 28.06"
  },
  {
    quote:
      "השליחה בוואטסאפ חסכה לנו שעות. הכל היה פשוט, יוקרתי ומקצועי — בדיוק כמו שרצינו שהחתונה תרגיש.",
    names: "יצחק ורעות",
    meta: "גן האירועים ריביירה | 14.05"
  },
  {
    quote:
      "מעקב המתנות והסטטוסים נתנו לנו שקט מדהים. הצוות של momoEVENT זמין, נעים ומדויק — ממליצים בחום.",
    names: "נועה ואורי",
    meta: "אולמי פנורמה | 03.04"
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

          <div
            id="landing-nav-menu"
            className={`landing-nav-menu${menuOpen ? " is-open" : ""}`}
          >
            <a
              className="landing-nav-link"
              href="#features"
              onClick={() => setMenuOpen(false)}
            >
              הפיצ&apos;רים
            </a>
            <a
              className="landing-nav-link"
              href="#testimonials"
              onClick={() => setMenuOpen(false)}
            >
              כותבים עלינו
            </a>
            <a
              className="landing-nav-link"
              href="#contact"
              onClick={() => setMenuOpen(false)}
            >
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

          <p className="landing-eyebrow">RSVP & Event Guest Management</p>
          <h1 className="landing-title">
            momoEVENT — מערכת אישורי הגעה והזמנות דיגיטליות חכמות לאירועים
          </h1>
          <p className="landing-subtitle">
            עושים לכם סדר במוזמנים בקלות ובלי כאבי ראש. משלמים רק על מה שצריכים — שקל אחד בלבד
            לרשומה, ואתם קובעים את הכמות.
          </p>

          <div className="landing-cta-row">
            <Link className="landing-cta landing-cta--primary" to="/client/login">
              נסו את המערכת בחינם
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <a className="landing-cta landing-cta--whatsapp" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
              דברו איתנו בוואטסאפ
              <MessageCircle size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <section className="landing-section landing-about">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">מי אנחנו ומה אנחנו נותנים?</h2>
          <p className="landing-about-text">
            momoEVENT היא מערכת טכנולוגית מתקדמת לניהול מוזמנים לאירועים — חתונות, בר/בת מצווה, בריתות
            ועוד. היא מאפשרת לבעלי האירוע לשלוט בהכל מהנייד או המחשב, ברוגע ובביטחון: רשימות מוזמנים,
            הזמנה דיגיטלית, אישורי הגעה, תזכורות ומעקב מתנות — הכל במקום אחד.
          </p>
        </div>
      </section>

      <section id="features" className="landing-section landing-features">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">אילו פיצ&apos;רים מחכים לכם במערכת?</h2>
          <div className="landing-features-grid">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="landing-feature-card">
                  <div className="landing-feature-icon" aria-hidden="true">
                    <Icon size={24} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="testimonials" className="landing-section landing-testimonials">
        <div className="landing-section-inner">
          <p className="landing-section-eyebrow">אמון מהשטח</p>
          <h2 className="landing-section-title">כותבים עלינו</h2>
          <p className="landing-section-lead">
            זוגות שבחרו ב־momoEVENT מספרים איך החוויה הרגישה באמת — פשוטה, יוקרתית ומסודרת עד הפרט
            האחרון.
          </p>
          <div className="landing-testimonials-grid">
            {TESTIMONIALS.map((item) => (
              <article key={item.names} className="landing-testimonial-card">
                <div className="landing-testimonial-quote-icon" aria-hidden="true">
                  <Quote size={22} strokeWidth={1.75} />
                </div>
                <p className="landing-testimonial-text">{item.quote}</p>
                <div className="landing-testimonial-footer">
                  <strong className="landing-testimonial-names">{item.names}</strong>
                  <span className="landing-testimonial-meta">{item.meta}</span>
                </div>
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
              נשמח להתאים לכם את החבילה המושלמת לאירוע שלכם — בלי לחץ, בלי בלבול, ועם ליווי אישי לכל
              אורך הדרך.
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

            <button className="landing-cta landing-cta--primary landing-contact-submit" type="submit" disabled={contactBusy}>
              {contactBusy ? "שולחים…" : "שלחו לנו הודעה"}
            </button>
          </form>
        </div>
      </section>

      <footer className="landing-footer">
        <p>momoEVENT · מערכת אישורי הגעה והזמנות דיגיטליות</p>
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
        הודעתכם התקבלה בהצלחה! נציג ממומו איוונט יחזור אליכם בהקדם ??
      </div>
    </div>
  );
}
