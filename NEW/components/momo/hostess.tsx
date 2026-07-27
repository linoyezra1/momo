import Image from 'next/image'
import { UserCheck } from 'lucide-react'

const steps = [
  {
    num: '1',
    title: 'שמים מישהו מטעמכם על המסך',
    text: 'כל אחד יכול לתפעל את ממשק הדיילת — לא צריך חברת סידורי הושבה יקרה.',
  },
  {
    num: '2',
    title: 'האורח מגיע, מחפשים אותו',
    text: 'מחפשים לפי שם או מספר טלפון, ותוך שנייה רואים באיזה שולחן הוא יושב.',
  },
  {
    num: '3',
    title: 'מושיבים גם מי שלא הוזמן מראש',
    text: 'הגיע מישהו בלי מקום? המערכת מציעה שולחנות ריקים ומקומות פנויים, ואפשר אפילו לשלוח לו את מספר השולחן בוואטסאפ בזמן אמת.',
  },
]

export function Hostess() {
  return (
    <section id="hostess" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
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
            ממשק הדיילת של מומו מאפשר לכם לנהל את קבלת האורחים לבד, בלי לשלם
            לחברת סידורי הושבה. ככה זה עובד:
          </p>

          <ol className="mt-7 space-y-5 text-right">
            {steps.map((s) => (
              <li key={s.num} className="flex items-start gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif font-bold text-primary-foreground">
                  {s.num}
                </span>
                <div>
                  <h3 className="font-semibold text-primary">{s.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-accent/10" />
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
            <Image
              src="/images/hostess.png"
              alt="ממשק הדיילת הדיגיטלית על טאבלט"
              width={720}
              height={560}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
