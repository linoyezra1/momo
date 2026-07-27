import Image from 'next/image'
import { LayoutGrid } from 'lucide-react'

export function Seating() {
  return (
    <section id="seating" className="border-y border-border bg-secondary/50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className="order-2 md:order-1">
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
            <Image
              src="/images/seating.png"
              alt="מסך סידורי הושבה עם שולחנות עגולים וכרטיסי מוזמנים"
              width={720}
              height={560}
              className="h-full w-full object-cover"
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
            מציירים את האולם על גבי קנבס, ופשוט גוררים את המוזמנים לשולחנות.
            בלי אקסלים מסובכים ובלי כאב ראש — הכל ויזואלי, פשוט וברור.
          </p>
          <ul className="mt-6 space-y-3 text-right">
            {[
              'מסדרים את האולם בדיוק כמו במציאות',
              'גוררים כל מוזמן לשולחן שלו',
              'רואים בכל רגע כמה מקומות פנויים בכל שולחן',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                <span className="leading-relaxed text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
