import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Gift, MessageCircle, Sparkles, Users } from "lucide-react";
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

export default function LandingPage() {
  return (
    <div className="landing-page" dir="rtl" lang="he">
      <header className="landing-hero">
        <div className="landing-glow landing-glow--one" aria-hidden="true" />
        <div className="landing-glow landing-glow--two" aria-hidden="true" />

        <div className="landing-hero-inner">
          <div className="landing-logo-wrap" aria-hidden="true">
            <div className="landing-logo-circle">
              <img className="landing-logo-image" src="/logo-momo.png" alt="" />
              <span className="landing-logo-text">momoEVENT</span>
              <span className="landing-logo-confetti" aria-hidden="true">
                ??
              </span>
            </div>
          </div>

          <p className="landing-eyebrow">RSVP & Event Guest Management</p>
          <h1 className="landing-title">
            momoEVENT – מערכת אישורי הגעה והזמנות דיגיטליות חכמות לאירועים ??
          </h1>
          <p className="landing-subtitle">
            עושים לכם סדר במוזמנים בקלות ובלי כאבי ראש. משלמים רק על מה שצריכים – שקל אחד בלבד לרשומה,
            ואתם קובעים את הכמות!
          </p>

          <div className="landing-cta-row">
            <Link className="landing-cta landing-cta--primary" to="/client/login">
              נסו את המערכת בחינם (ללא עלות)
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

      <section className="landing-section landing-features">
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

      <footer className="landing-footer">
        <p>momoEVENT · מערכת אישורי הגעה והזמנות דיגיטליות</p>
        <div className="landing-footer-links">
          <Link className="landing-footer-link" to="/client/login">
            כניסת לקוחות
          </Link>
          <a className="landing-footer-link" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
            וואטסאפ ישיר
          </a>
        </div>
      </footer>
    </div>
  );
}
