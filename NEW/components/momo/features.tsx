import {
  Users,
  Image as ImageIcon,
  ClipboardList,
  Wallet,
  MessageCircle,
  Bell,
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'ניהול מוזמנים',
    text: 'כל רשימת המוזמנים במקום אחד. אפשר גם להעלות מוזמנים ישר מאנשי הקשר בטלפון, וגם מקובץ אקסל אם בא לכם.',
  },
  {
    icon: ImageIcon,
    title: 'הזמנה דיגיטלית',
    text: 'עורכים את ההזמנה אונליין והיא מתעדכנת מיד. מוסיפים תמונה שלכם או את ההזמנה שלכם, ומשתפים בקלות.',
  },
  {
    icon: ClipboardList,
    title: 'העלאה מאנשי הקשר',
    text: 'רק רוצים להתחיל את הרשימה הראשונית? מסמנים אנשי קשר ומעלים אותם ישר למערכת. אפשר גם מאקסל.',
  },
  {
    icon: Wallet,
    title: 'ניהול ספקים ותקציב',
    text: 'קיבלתם כמה הצעות מחיר? במקום לשמור באנשי הקשר, מכניסים הכל למערכת. היא שומרת לכם את כל הפרטים וההצעות.',
  },
  {
    icon: MessageCircle,
    title: 'הודעות וואטסאפ ללא הגבלה',
    text: 'שולחים הזמנה אישית עם השם של המוזמן — ישירות מהוואטסאפ האישי שלכם, בלי הגבלה ובלי עלות.',
  },
  {
    icon: Bell,
    title: 'לוג עדכונים מלא',
    text: 'רואים בדיוק מי אישר, מתי, ומה עדכן. כי לפעמים האורחים משנים את דעתם — ואתם תמיד יודעים מה קורה.',
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
          כל מה שצריך כדי לארגן חתונה
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          לא רק אישורי הגעה — מערכת שלמה שמלווה אתכם מהרגע שהתחלתם ועד היום עצמו.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <f.icon className="size-6" />
            </span>
            <h3 className="mt-5 font-serif text-xl font-semibold text-primary">
              {f.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
