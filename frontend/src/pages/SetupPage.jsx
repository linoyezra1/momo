import { useState } from "react";
import api from "../api.js";
import "../us/us.css";

const emptyTimelineItem = { time: "", title: "" };

const initialForm = {
  etsyOrderId: "",
  contactEmail: "",
  slug: "",
  hostNames: "",
  introText: "Together with their families",
  celebrationText: "Invite you to their wedding celebration",
  eventDateFormatted: "",
  eventTime: "",
  countdownTargetDate: "",
  venueName: "",
  venueDescription: "",
  venueAddress: "",
  venueMapsLink: "",
  dressCode: "",
  deadlineText: "",
  registryLink: "",
  includeTimeline: false,
  includeTransportation: false,
  includeAccommodation: false,
  transportation: "",
  accommodationTitle: "",
  accommodationSubtitle: "",
  accommodationBody: "",
  timeline: [{ ...emptyTimelineItem }]
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function SetupPage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function onChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "hostNames" && !prev.slug ? { slug: slugify(value.replace("&", "-")) } : {})
    }));
  }

  function onTimelineChange(index, field, value) {
    setForm((prev) => {
      const timeline = [...prev.timeline];
      timeline[index] = { ...timeline[index], [field]: value };
      return { ...prev, timeline };
    });
  }

  function addTimelineItem() {
    setForm((prev) => ({ ...prev, timeline: [...prev.timeline, { ...emptyTimelineItem }] }));
  }

  function removeTimelineItem(index) {
    setForm((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function onSubmit(submitEvent) {
    submitEvent.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    const payload = {
      etsyOrderId: form.etsyOrderId,
      contactEmail: form.contactEmail,
      slug: form.slug,
      hostNames: form.hostNames,
      introText: form.introText,
      celebrationText: form.celebrationText,
      eventDateFormatted: form.eventDateFormatted,
      eventTime: form.eventTime,
      countdownTargetDate: form.countdownTargetDate
        ? new Date(form.countdownTargetDate).toISOString()
        : "",
      venue: {
        name: form.venueName,
        description: form.venueDescription,
        address: form.venueAddress,
        mapsLink: form.venueMapsLink
      },
      details: {
        dressCode: form.dressCode,
        transportation: form.transportation,
        accommodationTitle: form.accommodationTitle,
        accommodationSubtitle: form.accommodationSubtitle,
        accommodationBody: form.accommodationBody
      },
      rsvpSettings: {
        deadlineText: form.deadlineText,
        registryLink: form.registryLink
      },
      features: {
        includeTimeline: form.includeTimeline,
        includeTransportation: form.includeTransportation,
        includeAccommodation: form.includeAccommodation
      },
      timeline: form.includeTimeline
        ? form.timeline.filter((item) => item.time.trim() && item.title.trim())
        : []
    };

    try {
      const response = await api.post("/public/setup", payload);
      setResult(response.data);
    } catch (submitError) {
      setError(submitError.response?.data?.message || "Setup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="us-invite-page min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-sm border border-border bg-card p-8 text-center">
          <p className="font-script text-4xl text-primary">You&apos;re all set!</p>
          <h1 className="mt-4 font-serif text-2xl uppercase tracking-[0.2em] text-foreground">
            Your invitation is live
          </h1>
          <p className="mt-6 font-sans text-sm text-muted-foreground">
            Save these credentials — they won&apos;t be shown again.
          </p>

          <div className="mt-8 space-y-4 text-left font-sans text-sm">
            <p>
              <span className="text-muted-foreground">Invitation URL:</span>{" "}
              <a href={result.eventUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                {result.eventUrl}
              </a>
            </p>
            <p>
              <span className="text-muted-foreground">Username:</span> {result.credentials.username}
            </p>
            <p>
              <span className="text-muted-foreground">Password:</span> {result.credentials.password}
            </p>
            <p>
              <span className="text-muted-foreground">Dashboard:</span>{" "}
              <a href={result.clientDashboardUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                {result.clientDashboardUrl}
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="us-invite-page min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="font-script text-5xl text-primary">Welcome</p>
          <h1 className="mt-2 font-serif text-3xl uppercase tracking-[0.25em] text-foreground">
            Set Up Your Invitation
          </h1>
          <p className="mt-4 font-sans text-sm text-muted-foreground">
            Complete this form to create your account and launch your wedding website.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-12 space-y-10">
          <section className="space-y-4 rounded-sm border border-border bg-card p-6">
            <h2 className="font-serif text-xl uppercase tracking-[0.2em] text-foreground">Account &amp; Etsy</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 font-sans text-sm">
                Etsy Order ID *
                <input
                  name="etsyOrderId"
                  value={form.etsyOrderId}
                  onChange={onChange}
                  required
                  className="border border-border bg-transparent px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm">
                Contact Email *
                <input
                  name="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={onChange}
                  required
                  className="border border-border bg-transparent px-3 py-2"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 font-sans text-sm">
              Event URL Slug * (e.g. emma-and-lucas)
              <input
                name="slug"
                value={form.slug}
                onChange={onChange}
                required
                pattern="[a-z0-9-]{3,60}"
                className="border border-border bg-transparent px-3 py-2"
              />
            </label>
          </section>

          <section className="space-y-4 rounded-sm border border-border bg-card p-6">
            <h2 className="font-serif text-xl uppercase tracking-[0.2em] text-foreground">Couple &amp; Date</h2>
            <label className="flex flex-col gap-2 font-sans text-sm">
              Host Names * (e.g. Emma &amp; Lucas)
              <input
                name="hostNames"
                value={form.hostNames}
                onChange={onChange}
                required
                className="border border-border bg-transparent px-3 py-2"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 font-sans text-sm">
                Intro Text
                <input name="introText" value={form.introText} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm">
                Celebration Text
                <input
                  name="celebrationText"
                  value={form.celebrationText}
                  onChange={onChange}
                  className="border border-border bg-transparent px-3 py-2"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 font-sans text-sm">
                Date (formatted) *
                <input
                  name="eventDateFormatted"
                  placeholder="Saturday, July 22, 2027"
                  value={form.eventDateFormatted}
                  onChange={onChange}
                  required
                  className="border border-border bg-transparent px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm">
                Time *
                <input
                  name="eventTime"
                  placeholder="at 3:30 pm"
                  value={form.eventTime}
                  onChange={onChange}
                  required
                  className="border border-border bg-transparent px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm">
                Countdown ISO Date *
                <input
                  name="countdownTargetDate"
                  type="datetime-local"
                  value={form.countdownTargetDate}
                  onChange={onChange}
                  required
                  className="border border-border bg-transparent px-3 py-2"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-sm border border-border bg-card p-6">
            <h2 className="font-serif text-xl uppercase tracking-[0.2em] text-foreground">Venue</h2>
            <label className="flex flex-col gap-2 font-sans text-sm">
              Venue Name *
              <input name="venueName" value={form.venueName} onChange={onChange} required className="border border-border bg-transparent px-3 py-2" />
            </label>
            <label className="flex flex-col gap-2 font-sans text-sm">
              Description
              <textarea name="venueDescription" rows={3} value={form.venueDescription} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 font-sans text-sm">
                Address
                <input name="venueAddress" value={form.venueAddress} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm">
                Google Maps Link
                <input name="venueMapsLink" value={form.venueMapsLink} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-sm border border-border bg-card p-6">
            <h2 className="font-serif text-xl uppercase tracking-[0.2em] text-foreground">Details &amp; RSVP</h2>
            <label className="flex flex-col gap-2 font-sans text-sm">
              Dress Code
              <textarea name="dressCode" rows={2} value={form.dressCode} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 font-sans text-sm">
                RSVP Deadline Text
                <input name="deadlineText" value={form.deadlineText} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
              </label>
              <label className="flex flex-col gap-2 font-sans text-sm">
                Wedding Registry Link
                <input name="registryLink" value={form.registryLink} onChange={onChange} className="border border-border bg-transparent px-3 py-2" />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-sm border border-border bg-card p-6">
            <h2 className="font-serif text-xl uppercase tracking-[0.2em] text-foreground">Optional Sections</h2>

            <label className="flex items-center gap-3 font-sans text-sm">
              <input type="checkbox" name="includeTimeline" checked={form.includeTimeline} onChange={onChange} />
              Include Event Timeline
            </label>
            {form.includeTimeline ? (
              <div className="space-y-3 border-l-2 border-primary/30 pl-4">
                {form.timeline.map((item, index) => (
                  <div key={`timeline-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      placeholder="3:30 PM"
                      value={item.time}
                      onChange={(event) => onTimelineChange(index, "time", event.target.value)}
                      className="border border-border bg-transparent px-3 py-2 font-sans text-sm"
                    />
                    <input
                      placeholder="Wedding Ceremony"
                      value={item.title}
                      onChange={(event) => onTimelineChange(index, "title", event.target.value)}
                      className="border border-border bg-transparent px-3 py-2 font-sans text-sm"
                    />
                    {form.timeline.length > 1 ? (
                      <button type="button" onClick={() => removeTimelineItem(index)} className="font-sans text-xs text-muted-foreground">
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                <button type="button" onClick={addTimelineItem} className="font-sans text-xs uppercase tracking-[0.2em] text-primary">
                  + Add timeline item
                </button>
              </div>
            ) : null}

            <label className="flex items-center gap-3 font-sans text-sm">
              <input type="checkbox" name="includeTransportation" checked={form.includeTransportation} onChange={onChange} />
              Include Transportation Info
            </label>
            {form.includeTransportation ? (
              <textarea
                name="transportation"
                rows={3}
                value={form.transportation}
                onChange={onChange}
                placeholder="Shuttle and parking details"
                className="border border-border bg-transparent px-3 py-2 font-sans text-sm"
              />
            ) : null}

            <label className="flex items-center gap-3 font-sans text-sm">
              <input type="checkbox" name="includeAccommodation" checked={form.includeAccommodation} onChange={onChange} />
              Include Accommodation (Hotel Room Blocks)
            </label>
            {form.includeAccommodation ? (
              <div className="space-y-3 border-l-2 border-primary/30 pl-4">
                <input
                  name="accommodationTitle"
                  placeholder="Stay at Marriott Hotel"
                  value={form.accommodationTitle}
                  onChange={onChange}
                  className="w-full border border-border bg-transparent px-3 py-2 font-sans text-sm"
                />
                <input
                  name="accommodationSubtitle"
                  placeholder="Rates from $250 per night"
                  value={form.accommodationSubtitle}
                  onChange={onChange}
                  className="w-full border border-border bg-transparent px-3 py-2 font-sans text-sm"
                />
                <textarea
                  name="accommodationBody"
                  rows={3}
                  value={form.accommodationBody}
                  onChange={onChange}
                  className="w-full border border-border bg-transparent px-3 py-2 font-sans text-sm"
                />
              </div>
            ) : null}
          </section>

          {error ? <p className="font-sans text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-primary px-10 py-4 font-sans text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Creating your invitation…" : "Launch My Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
