"use client"

import type React from "react"
import { useState } from "react"
import { eventData } from "@/lib/event-data"

export function Rsvp() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <section
      className="relative overflow-hidden bg-cover bg-center px-6 py-24"
      style={{ backgroundImage: `url('${eventData.images.rsvp_bg}')` }}
    >
      <div className="relative z-10 mx-auto max-w-xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">Please</p>
        <h2 className="mt-1 font-serif text-4xl uppercase tracking-[0.4em] text-foreground md:text-5xl">
          RSVP
        </h2>
        <p className="mt-4 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {eventData.rsvp_settings.deadline_text}
        </p>
        <p className="mt-6 font-sans text-sm leading-relaxed text-muted-foreground">
          Ready to party? Fill out the RSVP form below and let us know you&apos;re in!
        </p>

        {submitted ? (
          <div className="mt-12 rounded-sm border border-border bg-card px-8 py-12">
            <p className="font-script text-4xl text-primary">Thank you!</p>
            <p className="mt-3 font-sans text-sm text-muted-foreground">
              We&apos;ve received your RSVP and can&apos;t wait to celebrate with you.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-5 text-left">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="attending" className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Will you attend?
              </label>
              <select
                id="attending"
                name="attending"
                className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                <option value="yes">Joyfully accepts</option>
                <option value="no">Regretfully declines</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="guests" className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Number of Guests
              </label>
              <input
                id="guests"
                name="guests"
                type="number"
                min={1}
                max={10}
                defaultValue={1}
                className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="mt-6 self-center border border-primary px-10 py-3 font-sans text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              RSVP Here
            </button>
          </form>
        )}

        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Help us celebrate
          </p>
          <a
            href={eventData.rsvp_settings.registry_link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-script text-3xl text-primary underline-offset-4 transition-opacity hover:opacity-70"
          >
            View our Registry
          </a>
        </div>
      </div>
    </section>
  )
}
