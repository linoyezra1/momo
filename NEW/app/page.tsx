import { SiteHeader } from '@/components/momo/site-header'
import { Hero } from '@/components/momo/hero'
import { Showcase } from '@/components/momo/showcase'
import { WhyFree } from '@/components/momo/why-free'
import { Features } from '@/components/momo/features'
import { Seating } from '@/components/momo/seating'
import { Hostess } from '@/components/momo/hostess'
import { Whatsapp } from '@/components/momo/whatsapp'
import { Pricing } from '@/components/momo/pricing'
import { SiteFooter } from '@/components/momo/site-footer'

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <Showcase />
      <WhyFree />
      <Features />
      <Seating />
      <Hostess />
      <Whatsapp />
      <Pricing />
      <SiteFooter />
    </main>
  )
}
