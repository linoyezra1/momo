"use client"

import { useEffect, useState } from "react"
import { eventData } from "@/lib/event-data"

const TARGET = new Date(eventData.countdown_target_date)

function getRemaining() {
  const diff = Math.max(0, TARGET.getTime() - Date.now())
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

export function Countdown() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    setTime(getRemaining())
    const id = setInterval(() => setTime(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [])

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Minutes", value: time.minutes },
    { label: "Seconds", value: time.seconds },
  ]

  return (
    <section
      className="bg-cover bg-center px-6 py-28 text-center"
      style={{ backgroundImage: `url('${eventData.images.countdown_bg}')` }}
    >
      <p className="font-script text-5xl text-card md:text-6xl">the</p>
      <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-card md:text-4xl">
        Countdown
      </h2>
      <p className="mx-auto mt-4 max-w-md font-sans text-xs uppercase tracking-[0.25em] text-card/90">
        To our forever begins
      </p>

      <div className="mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-3 md:gap-6">
        {units.map((u) => (
          <div
            key={u.label}
            className="flex flex-col items-center rounded-sm border border-card/30 bg-card/15 px-2 py-6 backdrop-blur-sm md:py-8"
          >
            <span className="font-serif text-4xl font-light text-card md:text-6xl">
              {String(u.value).padStart(2, "0")}
            </span>
            <span className="mt-2 font-sans text-[0.6rem] uppercase tracking-[0.25em] text-card/90 md:text-xs">
              {u.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
