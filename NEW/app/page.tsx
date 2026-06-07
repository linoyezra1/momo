import { Hero } from "@/components/hero"
import { Countdown } from "@/components/countdown"
import { Schedule } from "@/components/schedule"
import { Venue } from "@/components/venue"
import { Accommodation } from "@/components/accommodation"
import { Details } from "@/components/details"
import { Rsvp } from "@/components/rsvp"
import { Footer } from "@/components/footer"
import { eventData } from "@/lib/event-data"

export default function Page() {
  return (
    <main
      className="min-h-screen bg-background bg-repeat-y"
      style={{
        backgroundImage: `url('${eventData.images.hero_bg}')`,
        backgroundSize: "100% auto",
        backgroundPosition: "top center",
      }}
    >
      <Hero />
      <Countdown />
      <Schedule />
      <Venue />
      <Accommodation />
      <Details />
      <Rsvp />
      <Footer />
    </main>
  )
}
