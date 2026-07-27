import { Heart, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SiteFooter() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground md:px-12">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <PartyPopper className="size-6" />
          </span>
          <h2 className="mt-5 text-balance font-serif text-3xl font-bold md:text-4xl">
            מוכנים להתחיל לתכנן?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty leading-relaxed text-primary-foreground/80">
            נרשמים בחינם, מעלים את המוזמנים ומתחילים לשלוח הזמנות. בלי כרטיס
            אשראי ובלי התחייבות.
          </p>
          <Button
            size="lg"
            className="mt-7 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            מתחילים בחינם עם מומו
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Heart className="size-4" fill="currentColor" />
            </span>
            <span className="font-serif text-xl font-bold text-primary">מומו</span>
          </div>
          <p className="text-sm text-muted-foreground">
            אישורי הגעה והזמנות דיגיטליות, נגיש לכל כיס.
          </p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} מומו. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </>
  )
}
