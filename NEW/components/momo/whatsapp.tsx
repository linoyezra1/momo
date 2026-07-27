import { MessageCircle, Send, Phone, CalendarClock } from 'lucide-react'

const extras = [
  {
    icon: Send,
    title: 'הזמנה מהוואטסאפ האישי שלכם',
    text: 'ההזמנה נשלחת עם השם של המוזמן, אבל מהמספר האישי שלכם — לא ממספר של חברה. ככה זה יותר אישי, וזה בחינם.',
  },
  {
    icon: MessageCircle,
    title: 'שליחה מוואטסאפ החברה',
    text: 'רוצים לשלוח כמות גדולה ממספר של החברה? יש לזה עלות, וההודעות יוצאות עם כפתורי אישור מהירים כדי לקבל יותר תשובות.',
  },
  {
    icon: Phone,
    title: 'אישורי הגעה טלפוניים',
    text: 'לא לכולם מתאים וואטסאפ. למי שצריך, אנחנו עושים גם אישורי הגעה טלפוניים אנושיים. הפרטים במחירון.',
  },
  {
    icon: CalendarClock,
    title: 'הכל לפי הצורך שלכם',
    text: 'בלי התחייבות לתוכנית. אפשר לקנות 12 רשומות, 36 או 102 — בלי מגבלות, רק לפי מה שאתם באמת צריכים.',
  },
]

export function Whatsapp() {
  return (
    <section className="border-y border-border bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
            אם הכל חינם — מה יוצא לנו מזה?
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            קודם כל, מהפכה קטנה באולם החתונות. וברור שלא עובדים בחינם: מי שרוצה,
            יכול לשדרג ולשלוח הודעות מהמערכת או להוסיף אישורי הגעה טלפוניים.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {extras.map((e) => (
            <div
              key={e.title}
              className="flex gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <e.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-primary">
                  {e.title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {e.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-accent/30 bg-card p-6 text-center md:p-8">
          <p className="text-pretty text-lg leading-relaxed text-foreground">
            ובנימה אישית — עדיף לשלוח לאורחים הזמנה מהוואטסאפ האישי שלכם. הם
            משקיעים בשבילכם: מתארגנים, מביאים מעטפה, אולי אפילו לוקחים בייביסיטר.
            אז שווה להשקיע בהם הודעה אישית. ולמי שזה פחות מתאים — יש לנו גם
            שליחה מוואטסאפ החברה וגם אישורי הגעה טלפוניים אנושיים.
          </p>
        </div>
      </div>
    </section>
  )
}
