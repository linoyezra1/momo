import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Menu,
  MessageCircle,
  PartyPopper,
  Phone,
  Send,
  UserCheck,
  Users,
  Wallet,
  X
} from "lucide-react";
import LandingShowcase from "../landing/LandingShowcase.jsx";
import { buildSupportWhatsAppUrl } from "../utils/tableDispatchPurchase.js";
import "../landing.css";

const FREE_SIGNUP_WHATSAPP_TEXT = "באתי מהאתר ואני רוצה לפתוח משתמש במערכת בחינם";
const FREE_SIGNUP_WHATSAPP_LINK = buildSupportWhatsAppUrl(FREE_SIGNUP_WHATSAPP_TEXT);

const WHATSAPP_LINK =
  import.meta.env.VITE_MARKETING_WHATSAPP_URL ||
  buildSupportWhatsAppUrl("שלום, אשמח לקבל פרטים על מומו") ||
  "https://api.whatsapp.com/send?text=" + encodeURIComponent("שלום, אשמח לקבל פרטים על מומו");

const NAV_LINKS = [
  { label: "אישורי הגעה בחינם", href: "#why-free" },
  { label: "איך זה עובד", href: "#features" },
  { label: "סידורי הושבה", href: "#seating" },
  { label: "הדיילת", href: "#hostess" },
  { label: "מחירים", href: "#pricing" }
];

const FEATURE_SECTIONS = [
  {
    id: "feature-guests",
    icon: Users,
    badge: "ניהול מוזמנים",
    title: "כל המוזמנים במקום אחד",
    text: "רואים מי מגיע, מי עדיין לא ענה, וכמה אורחים בכל סטטוס — בלי אקסלים מפוזרים ובלי בלאגן. אפשר לחפש, לסנן ולערוך בקלות, והכל מתעדכן בזמן אמת.",
    points: [
      "רשימה חיה עם סטטוסים: מגיע / לא מגיע / אולי / לא ידוע",
      "ייבוא וייצוא קובצי אקסל (Excel) של מוזמנים",
      "עריכה מהירה של שם, טלפון וכמות אורחים"
    ],
    image: "/images/dashboard-bg.png",
    imageAlt: "מסך ניהול מוזמנים במומו",
    imageFirst: true
  },
  {
    id: "feature-invitation",
    icon: ImageIcon,
    badge: "הזמנה דיגיטלית",
    title: "הזמנה שמתעדכנת אונליין",
    text: "מעצבים את ההזמנה פעם אחת, משתפים לינק — ואם משהו משתנה (שעה, מיקום, טקסט) פשוט מעדכנים והאורחים רואים את הגרסה העדכנית. בלי להדפיס מחדש ובלי לשלוח שוב הכל מההתחלה.",
    points: [
      "עורכים פרטי אירוע, טקסטים ותמונה בקלות",
      "לינק אחד להזמנה + אישור הגעה",
      "השינויים עולים מיד — בלי להפיץ גרסה חדשה ידנית"
    ],
    image: "/images/hero-invitation.png",
    imageAlt: "הזמנה דיגיטלית על הטלפון",
    imageFirst: false
  },
  {
    id: "feature-import",
    icon: ClipboardList,
    badge: "ייבוא מוזמנים",
    title: "מעלים רשימה בלחיצה",
    text: "רוצים להתחיל מהר? מושכים מאנשי הקשר בטלפון, או מעלים קובץ אקסל מוכן. המערכת מסדרת כפילויות ושומרת את הרשימה מוכנה לעבודה.",
    points: [
      "ייבוא מאנשי הקשר בפלאפון — להתחלת רשימה ראשונית",
      "ייבוא וייצוא קובצי אקסל (Excel) של מוזמנים",
      "זיהוי כפילויות לפי מספר טלפון"
    ],
    image: "/images/suite.png",
    imageAlt: "ייבוא מוזמנים מאנשי קשר ומאקסל",
    imageFirst: true
  },
  {
    id: "feature-vendors",
    icon: Wallet,
    badge: "ספקים ותקציב",
    title: "ספקים והצעות מחיר — לא בוואטסאפ",
    text: "במקום 4 הצעות מחיר שזרוקות בצ'אטים ובאנשי קשר, מכניסים למומו את הספקים, הסכומים וההערות. הכל מסודר במקום אחד, כדי שתוכלו להשוות ולהחליט ברוגע.",
    points: [
      "שמירת ספקים, קטגוריות והצעות מחיר",
      "מעקב תקציב והוצאות לצד האירוע",
      "פחות חיפושים בוואטסאפ — יותר סדר"
    ],
    image: "/images/venue.png",
    imageAlt: "ניהול ספקים ותקציב במומו",
    imageFirst: false
  },
  {
    id: "feature-whatsapp",
    icon: MessageCircle,
    badge: "וואטסאפ בחינם",
    title: "שולחים מהמספר האישי שלכם",
    text: "בשירות החינמי שולחים הזמנה אישית עם שם המוזמן — ישירות מהוואטסאפ האישי שלכם. בלי הגבלה ובלי עלות. למי שצריך שליחה כמותית מהחברה — יש אפשרות בתשלום.",
    points: [
      "הודעה אישית עם שם האורח",
      "יוצאת מהמספר שלכם — לא ממספר חברה אנונימי",
      "ללא הגבלה בשירות החינמי"
    ],
    image: "/images/Please.png",
    imageAlt: "שליחת הזמנה בוואטסאפ",
    imageFirst: true
  },
  {
    id: "feature-audit",
    icon: Bell,
    badge: "לוג עדכונים",
    title: "רואים מי שינה — ומתי",
    text: "אורחים אוהבים לשנות דעה. הלוג מראה בדיוק מי אישר, מתי, ומה עודכן — מוואטסאפ, מהקישור, או מעדכון ידני. ככה תמיד יודעים מה קורה.",
    points: [
      "מעקב בזמן אמת אחרי שינויי סטטוס",
      "מקור העדכון ברור (אורח / נציג / זוג)",
      "תצוגה נוחה גם בנייד וגם במחשב"
    ],
    image: "/images/demo-invitation.png",
    imageAlt: "לוג עדכונים בזמן אמת",
    imageFirst: false
  }
];

const SEATING_POINTS = [
  "מסדרים את האולם בדיוק כמו במציאות",
  "גוררים כל מוזמן לשולחן שלו",
  "רואים בכל רגע כמה מקומות פנויים בכל שולחן"
];

const HOSTESS_STEPS = [
  {
    num: "1",
    title: "שמים מישהו מטעמכם על המסך",
    text: "כל אחד יכול לתפעל את ממשק הדיילת — לא צריך חברת סידורי הושבה יקרה."
  },
  {
    num: "2",
    title: "האורח מגיע, מחפשים אותו",
    text: "מחפשים לפי שם או מספר טלפון, ותוך שנייה רואים באיזה שולחן הוא יושב."
  },
  {
    num: "3",
    title: "מושיבים גם מי שלא הוזמן מראש",
    text: "הגיע מישהו בלי מקום? המערכת מציעה שולחנות ריקים ומקומות פנויים, ואפשר אפילו לשלוח לו את מספר השולחן בוואטסאפ בזמן אמת."
  }
];

const WHATSAPP_EXTRAS = [
  {
    icon: Send,
    title: "הזמנה מהוואטסאפ האישי שלכם",
    text: "ההזמנה נשלחת עם השם של המוזמן, אבל מהמספר האישי שלכם — לא ממספר של חברה. ככה זה יותר אישי, וזה בחינם."
  },
  {
    icon: MessageCircle,
    title: "שליחה מוואטסאפ החברה",
    text: "רוצים לשלוח כמות גדולה ממספר של החברה? יש לזה עלות, וההודעות יוצאות עם כפתורי אישור מהירים כדי לקבל יותר תשובות."
  },
  {
    icon: Phone,
    title: "אישורי הגעה טלפוניים",
    text: "לא לכולם מתאים וואטסאפ. למי שצריך, אנחנו עושים גם אישורי הגעה טלפוניים אנושיים. הפרטים במחירון."
  },
  {
    icon: CalendarClock,
    title: "הכל לפי הצורך שלכם",
    text: "בלי התחייבות לתוכנית. אפשר לקנות 12 רשומות, 36 או 102 — בלי מגבלות, רק לפי מה שאתם באמת צריכים."
  }
];

const BASE_FEATURES = [
  "ניהול מוזמנים",
  "ייבוא וייצוא קובצי אקסל (Excel) של מוזמנים",
  "העלאת מוזמנים מאנשי הקשר",
  "הזמנה דיגיטלית",
  "סידורי הושבה",
  "הדיילת הדיגיטלית",
  "ניהול ספקים",
  "הודעות וואטסאפ ללא הגבלה (מהוואטסאפ האישי שלכם)"
];

const PLANS = [
  {
    name: "החינמי",
    price: "0",
    unit: "₪",
    note: "כל הבסיס, בלי לשלם שקל.",
    features: BASE_FEATURES,
    cta: "הרשמה בחינם",
    highlight: false
  },
  {
    name: "הנגיש לכל כיס",
    price: "1",
    unit: "₪ לרשומה",
    note: "כאן אנחנו נכנסים לתמונה.",
    features: [
      ...BASE_FEATURES,
      "2 סבבי אישורי הגעה עם כפתורים בוואטסאפ",
      "2 סבבי אישורי הגעה טלפוניים אנושיים"
    ],
    cta: "בוחרים את זה",
    highlight: true
  },
  {
    name: "הרציניים",
    price: "1.8",
    unit: "₪ לרשומה",
    note: "למי שרוצה שנדאג להכל.",
    features: [
      ...BASE_FEATURES,
      "2 סבבי אישורי הגעה עם כפתורים בוואטסאפ",
      "2 סבבי אישורי הגעה טלפוניים אנושיים",
      "שליחת מספר שולחן למוזמנים בוואטסאפ",
      "תזכורת ביום האירוע",
      "שליחת מספר שולחן בזמן אמת על ידי הדיילת",
      "הודעת תודה ביום שאחרי"
    ],
    cta: "בוחרים את זה",
    highlight: false
  }
];

function FreeSignupButton({ className = "", children = "הרשמה בחינם", ...props }) {
  return (
    <a
      href={FREE_SIGNUP_WHATSAPP_LINK}
      target="_blank"
      rel="noreferrer"
      className={`text-white hover:text-white ${className}`.trim()}
      {...props}
    >
      {children}
    </a>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="landing-page min-h-screen bg-background" dir="rtl" lang="he">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="#" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Heart className="size-5" fill="currentColor" />
            </span>
            <span className="font-serif text-2xl font-bold text-primary">מומו</span>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <FreeSignupButton className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 sm:inline-flex">
              הרשמה בחינם
            </FreeSignupButton>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-primary md:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {menuOpen ? (
            <div className="absolute inset-x-4 top-[calc(100%+0.35rem)] z-50 rounded-2xl border border-border bg-card p-3 shadow-lg md:hidden">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <FreeSignupButton
                className="mt-2 flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                onClick={() => setMenuOpen(false)}
              >
                הרשמה בחינם
              </FreeSignupButton>
              <Link
                to="/client/login"
                className="mt-1 flex w-full items-center justify-center rounded-full px-4 py-2 text-sm text-muted-foreground"
                onClick={() => setMenuOpen(false)}
              >
                התחברות ללקוחות
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
            <div className="text-center md:text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
                <Heart className="size-4 text-accent" fill="currentColor" />
                אישורי הגעה בחינם. באמת.
              </span>

              <h1 className="mt-6 text-balance font-serif text-4xl font-bold leading-tight text-primary md:text-5xl lg:text-6xl">
                אישורי הגעה והזמנה דיגיטלית - בחינם.
              </h1>

              <p className="mx-auto mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground md:mx-0">
                מומו זו מערכת חינמית לאישורי הגעה, הזמנה דיגיטלית, ניהול מוזמנים, סידורי הושבה, דיילת
                דיגיטלית וניהול ספקים. מתחתנים, יש מלא הוצאות — ואישורי ההגעה צריכים להיות נגישים לכל
                כיס.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:justify-start">
                <FreeSignupButton className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 sm:w-auto">
                  הרשמה בחינם
                </FreeSignupButton>
                <a
                  href="#why-free"
                  className="inline-flex w-full items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-primary hover:bg-secondary sm:w-auto"
                >
                  קצת יותר פרטים...
                </a>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                בלי כרטיס אשראי · בלי התחייבות · מתחילים בכמה דקות
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-accent/10" />
              <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
                <img
                  src="/images/hero-invitation.png"
                  alt="הזמנה דיגיטלית לחתונה מוצגת על הטלפון"
                  className="h-full w-full object-cover"
                  width={720}
                  height={720}
                />
              </div>
              <div className="absolute bottom-5 right-5 flex items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
                <Heart className="size-4 text-accent" fill="currentColor" />
                הזמנה שמתעדכנת אונליין
              </div>
            </div>
          </div>
        </section>

        <section id="why-free" className="scroll-mt-20 border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center md:py-20">
            <h2 className="font-serif text-3xl font-bold text-primary md:text-4xl">
              איך מערכת כזו יכולה להיות בחינם?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              כי ככה זה צריך להיות. כשמתחתנים יש כל כך הרבה הוצאות, ואישורי ההגעה פשוט צריכים להיות
              נגישים לכל אחד. אצלנו כל הבסיס חינמי — ומשלמים רק אם רוצים תוספות כמו שליחת הודעות
              מהמערכת או אישורי הגעה טלפוניים. בשירות החינמי זה נשלח מהווצאפ האישי שלכם.
            </p>
          </div>
        </section>

        <LandingShowcase />

        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 pt-16 md:pt-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
                הפיצ&apos;רים במערכת החינמית
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                לא רק אישורי הגעה — מערכת שלמה שמלווה אתכם מהרגע שהתחלתם ועד היום עצמו. לכל פיצ׳ר יש
                הסבר מפורט והמחשה.
              </p>
            </div>
          </div>

          {FEATURE_SECTIONS.map((feature, index) => {
            const Icon = feature.icon;
            const altBg = index % 2 === 1;
            return (
              <section
                key={feature.id}
                id={feature.id}
                className={`scroll-mt-20 ${altBg ? "border-y border-border bg-secondary/50" : ""}`}
              >
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-20">
                  <div
                    className={`relative ${
                      feature.imageFirst ? "order-2 md:order-1" : "order-2 md:order-2"
                    }`}
                  >
                    <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-accent/10" />
                    <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
                      <img
                        src={feature.image}
                        alt={feature.imageAlt}
                        className="h-full w-full object-cover"
                        width={720}
                        height={560}
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <div
                    className={`text-center md:text-right ${
                      feature.imageFirst ? "order-1 md:order-2" : "order-1 md:order-1"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-4 py-1.5 text-sm font-medium text-accent">
                      <Icon className="size-4" />
                      {feature.badge}
                    </span>
                    <h3 className="mt-5 text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                      {feature.text}
                    </p>
                    <ul className="mt-6 space-y-3 text-right">
                      {feature.points.map((point) => (
                        <li key={point} className="flex items-start gap-3">
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                          <span className="leading-relaxed text-foreground">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            );
          })}
        </section>

        <section id="seating" className="scroll-mt-20 border-y border-border bg-secondary/50">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <div className="order-2 md:order-1">
              <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
                <img
                  src="/images/seating.png"
                  alt="מסך סידורי הושבה עם שולחנות עגולים וכרטיסי מוזמנים"
                  className="h-full w-full object-cover"
                  width={720}
                  height={560}
                  loading="lazy"
                />
              </div>
            </div>

            <div className="order-1 text-center md:order-2 md:text-right">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-4 py-1.5 text-sm font-medium text-accent">
                <LayoutGrid className="size-4" />
                סידורי הושבה — בחינם
              </span>
              <h2 className="mt-5 text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
                גוררים ומושיבים. זהו.
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                מציירים את האולם על גבי קנבס, ופשוט גוררים את המוזמנים לשולחנות. בלי אקסלים מסובכים
                ובלי כאב ראש — הכל ויזואלי, פשוט וברור.
              </p>
              <ul className="mt-6 space-y-3 text-right">
                {SEATING_POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                    <span className="leading-relaxed text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="hostess" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-24">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="text-center md:text-right">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-4 py-1.5 text-sm font-medium text-accent">
                <UserCheck className="size-4" />
                הדיילת הדיגיטלית
              </span>
              <h2 className="mt-5 text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
                חוסכים על דיילת קבלה
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                ממשק הדיילת של מומו מאפשר לכם לנהל את קבלת האורחים לבד, בלי לשלם לחברת סידורי הושבה.
                ככה זה עובד:
              </p>

              <ol className="mt-7 space-y-5 text-right">
                {HOSTESS_STEPS.map((step) => (
                  <li key={step.num} className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif font-bold text-primary-foreground">
                      {step.num}
                    </span>
                    <div>
                      <h3 className="font-semibold text-primary">{step.title}</h3>
                      <p className="mt-1 leading-relaxed text-muted-foreground">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-accent/10" />
              <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
                <img
                  src="/images/hostess.png"
                  alt="ממשק הדיילת הדיגיטלית על טאבלט"
                  className="h-full w-full object-cover"
                  width={720}
                  height={560}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
                אם הכל חינם — מה יוצא לנו מזה?
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                קודם כל, מהפכה קטנה באולם החתונות. וברור שלא עובדים בחינם: מי שרוצה, יכול לשדרג ולשלוח
                הודעות מהמערכת או להוסיף אישורי הגעה טלפוניים.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {WHATSAPP_EXTRAS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-primary">{item.title}</h3>
                      <p className="mt-1.5 leading-relaxed text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-accent/30 bg-card p-6 text-center md:p-8">
              <p className="text-pretty text-lg leading-relaxed text-foreground">
                ובנימה אישית — עדיף לשלוח לאורחים הזמנה מהוואטסאפ האישי שלכם. הם משקיעים בשבילכם:
                מתארגנים, מביאים מעטפה, אולי אפילו לוקחים בייביסיטר. אז שווה להשקיע בהם הודעה אישית.
                ולמי שזה פחות מתאים — יש לנו גם שליחה מוואטסאפ החברה וגם אישורי הגעה טלפוניים אנושיים.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
              מחירים פשוטים, בלי אותיות קטנות
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              מתחילים בחינם, ומשלמים רק על מה שבאמת צריך. בלי התחייבות לתוכנית.
            </p>
          </div>

          <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex h-full flex-col rounded-3xl border bg-card p-7 ${
                  plan.highlight ? "border-accent shadow-md lg:-translate-y-3" : "border-border"
                }`}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 right-7 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    הכי משתלם
                  </span>
                ) : null}

                <h3 className="font-serif text-2xl font-bold text-primary">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.note}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="font-serif text-4xl font-bold text-primary">{plan.price}</span>
                  <span className="mb-1 text-sm text-muted-foreground">{plan.unit}</span>
                </div>

                {plan.price === "0" ? (
                  <FreeSignupButton
                    className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    {plan.cta}
                  </FreeSignupButton>
                ) : (
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold ${
                      plan.highlight
                        ? "bg-accent text-white hover:bg-accent/90 hover:text-white"
                        : "bg-primary text-white hover:bg-primary/90 hover:text-white"
                    }`}
                  >
                    {plan.cta}
                  </a>
                )}

                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <Check className="size-3.5" />
                      </span>
                      <span className="text-sm leading-relaxed text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            אפשר לקנות רשומות לפי צורך — 12, 36, 102 או כל כמות אחרת. בלי מגבלות.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-3xl bg-primary px-6 py-14 text-center text-white md:px-12">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-white">
              <PartyPopper className="size-6" />
            </span>
            <h2 className="mt-5 text-balance font-serif text-3xl font-bold text-white md:text-4xl">
              מוכנים להתחיל לתכנן?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty leading-relaxed text-white/80">
              נרשמים בחינם, מעלים את המוזמנים ומתחילים לשלוח הזמנות. בלי כרטיס אשראי ובלי התחייבות.
            </p>
            <FreeSignupButton className="mt-7 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/90 hover:text-white">
              הרשמה בחינם עם מומו
            </FreeSignupButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Heart className="size-4" fill="currentColor" />
            </span>
            <span className="font-serif text-xl font-bold text-primary">מומו</span>
          </div>
          <p className="text-sm text-muted-foreground">אישורי הגעה והזמנות דיגיטליות, נגיש לכל כיס.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link to="/client/login" className="hover:text-primary">
              התחברות
            </Link>
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="hover:text-primary">
              וואטסאפ
            </a>
            <span>© {new Date().getFullYear()} מומו. כל הזכויות שמורות.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
