import Image from 'next/image'
import { Heart, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <div className="text-center md:text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-accent" />
            אישורי הגעה בחינם. באמת.
          </span>

          <h1 className="mt-6 text-balance font-serif text-4xl font-bold leading-tight text-primary md:text-6xl">
            כל החתונה שלכם
            <br />
            במקום אחד
          </h1>

          <p className="mx-auto mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground md:mx-0">
            מומו זו מערכת חינמית לאישורי הגעה, הזמנה דיגיטלית, ניהול מוזמנים,
            סידורי הושבה ודיילת דיגיטלית. מתחתנים, יש מלא הוצאות — ואישורי ההגעה
            צריכים להיות נגישים לכל כיס.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:justify-start">
            <Button
              size="lg"
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              מתחילים בחינם
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full border-border bg-card text-primary hover:bg-secondary sm:w-auto"
            >
              <a href="#pricing">רואים מה כלול</a>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            בלי כרטיס אשראי · בלי התחייבות · מתחילים בכמה דקות
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-accent/10" />
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
            <Image
              src="/images/hero-invitation.png"
              alt="הזמנה דיגיטלית לחתונה מוצגת על הטלפון"
              width={720}
              height={720}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="absolute bottom-5 right-5 flex items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
            <Heart className="size-4 text-accent" fill="currentColor" />
            הזמנה שמתעדכנת אונליין
          </div>
        </div>
      </div>
    </section>
  )
}
