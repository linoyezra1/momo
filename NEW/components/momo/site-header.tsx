import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'איך זה עובד', href: '#features' },
  { label: 'סידורי הושבה', href: '#seating' },
  { label: 'הדיילת', href: '#hostess' },
  { label: 'מחירים', href: '#pricing' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Heart className="size-5" fill="currentColor" />
          </span>
          <span className="font-serif text-2xl font-bold text-primary">מומו</span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
          מתחילים בחינם
        </Button>
      </div>
    </header>
  )
}
