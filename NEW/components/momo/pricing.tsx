import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const baseFeatures = [
  'ניהול מוזמנים',
  'העלאת מוזמנים מאנשי הקשר',
  'הזמנה דיגיטלית',
  'סידורי הושבה',
  'הדיילת הדיגיטלית',
  'ניהול ספקים',
  'הודעות וואטסאפ ללא הגבלה (מהוואטסאפ האישי שלכם)',
]

const plans = [
  {
    name: 'החינמי',
    price: '0',
    unit: '₪',
    note: 'כל הבסיס, בלי לשלם שקל.',
    features: baseFeatures,
    cta: 'מתחילים בחינם',
    highlight: false,
  },
  {
    name: 'הנגיש לכל כיס',
    price: '1',
    unit: '₪ לרשומה',
    note: 'כאן אנחנו נכנסים לתמונה.',
    features: [
      ...baseFeatures,
      '2 סבבי אישורי הגעה עם כפתורים בוואטסאפ',
      '2 סבבי אישורי הגעה טלפוניים אנושיים',
    ],
    cta: 'בוחרים את זה',
    highlight: true,
  },
  {
    name: 'הרציניים',
    price: '1.8',
    unit: '₪ לרשומה',
    note: 'למי שרוצה שנדאג להכל.',
    features: [
      ...baseFeatures,
      '2 סבבי אישורי הגעה עם כפתורים בוואטסאפ',
      '2 סבבי אישורי הגעה טלפוניים אנושיים',
      'שליחת מספר שולחן למוזמנים בוואטסאפ',
      'תזכורת ביום האירוע',
      'שליחת מספר שולחן בזמן אמת על ידי הדיילת',
      'הודעת תודה ביום שאחרי',
    ],
    cta: 'בוחרים את זה',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
          מחירים פשוטים, בלי אותיות קטנות
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          מתחילים בחינם, ומשלמים רק על מה שבאמת צריך. בלי התחייבות לתוכנית.
        </p>
      </div>

      <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex h-full flex-col rounded-3xl border bg-card p-7 ${
              plan.highlight
                ? 'border-accent shadow-md lg:-translate-y-3'
                : 'border-border'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 right-7 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                הכי משתלם
              </span>
            )}

            <h3 className="font-serif text-2xl font-bold text-primary">
              {plan.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.note}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="font-serif text-4xl font-bold text-primary">
                {plan.price}
              </span>
              <span className="mb-1 text-sm text-muted-foreground">
                {plan.unit}
              </span>
            </div>

            <Button
              className={`mt-6 w-full rounded-full ${
                plan.highlight
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {plan.cta}
            </Button>

            <ul className="mt-7 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">
                    {feature}
                  </span>
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
  )
}
