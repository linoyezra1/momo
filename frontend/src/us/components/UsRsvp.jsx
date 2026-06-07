import { useEffect, useState } from "react";
import api from "../../api.js";

const DIETARY_OPTIONS = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy"];
const initialForm = {
  fullName: "",
  email: "",
  status: "Joyfully Accepts",
  attendeesCount: 1,
  dietaryRestrictions: [],
  dietaryNotes: ""
};

function toggleDietary(current, option) {
  if (option === "None") {
    return current.includes("None") ? [] : ["None"];
  }
  const withoutNone = current.filter((item) => item !== "None");
  if (withoutNone.includes(option)) {
    return withoutNone.filter((item) => item !== option);
  }
  return [...withoutNone, option];
}

export default function UsRsvp({ event, slug }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const isAttending = form.status === "Joyfully Accepts";
  const deadlineText = event.rsvp_settings?.deadline_text || "";
  const registryLink = event.rsvp_settings?.registry_link || "";

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }
    const onKeyDown = (eventKey) => {
      if (eventKey.key === "Escape") {
        setModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  function onFieldChange(eventChange) {
    const { name, value } = eventChange.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(submitEvent) {
    submitEvent.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await api.post(`/public/event/by-slug/${slug}/rsvp`, {
        fullName: form.fullName,
        email: form.email,
        status: form.status,
        attendeesCount: isAttending ? Number(form.attendeesCount) : 0,
        dietaryRestrictions: isAttending ? form.dietaryRestrictions : [],
        dietaryNotes: isAttending ? form.dietaryNotes : ""
      });
      setSubmitted(true);
      setModalOpen(false);
    } catch (submitError) {
      setError(submitError.response?.data?.message || "Failed to submit RSVP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function openModal() {
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (!submitting) {
      setModalOpen(false);
    }
  }

  return (
    <>
      <section className="relative overflow-hidden bg-[url('/images/Please.png')] bg-cover bg-center bg-no-repeat px-6 py-24">
        <div className="pointer-events-none absolute inset-0 bg-[#fdfbf7]/68" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-xl text-center">
          <p className="font-script text-5xl text-primary md:text-6xl">Please</p>
          <h2 className="mt-1 font-serif text-4xl uppercase tracking-[0.4em] text-foreground md:text-5xl">RSVP</h2>
          {deadlineText ? (
            <p className="mt-4 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {deadlineText}
            </p>
          ) : null}
          <p className="mt-6 font-sans text-sm leading-relaxed text-muted-foreground">
            Ready to party? Let us know you&apos;re in!
          </p>

          {submitted ? (
            <div className="mt-12 rounded-sm border border-border bg-card/95 px-8 py-12 shadow-sm backdrop-blur-[1px]">
              <p className="font-script text-4xl text-primary">Thank you!</p>
              <p className="mt-3 font-sans text-sm text-muted-foreground">
                We&apos;ve received your RSVP and can&apos;t wait to celebrate with you.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={openModal}
              className="mt-12 border border-primary px-10 py-3 font-sans text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              RSVP Here
            </button>
          )}

          {registryLink ? (
            <div className="mt-12 flex flex-col items-center gap-3">
              <p className="font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">Help us celebrate</p>
              <a
                href={registryLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-script text-3xl text-primary underline-offset-4 transition-opacity hover:opacity-70"
              >
                View our Registry
              </a>
            </div>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="us-rsvp-modal-backdrop" onClick={closeModal} role="presentation">
          <div
            className="us-rsvp-modal"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="us-rsvp-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-script text-3xl text-primary">RSVP</p>
                <h3 id="us-rsvp-title" className="mt-1 font-serif text-xl uppercase tracking-[0.25em] text-foreground">
                  Respond to our invitation
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="font-sans text-sm text-muted-foreground hover:text-foreground"
                aria-label="Close RSVP form"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5 text-left">
              <div className="flex flex-col gap-2">
                <label htmlFor="fullName" className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={onFieldChange}
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
                  value={form.email}
                  onChange={onFieldChange}
                  className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="status" className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Attendance
                </label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={onFieldChange}
                  className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
                >
                  <option value="Joyfully Accepts">Joyfully Accepts</option>
                  <option value="Regretfully Declines">Regretfully Declines</option>
                </select>
              </div>

              {isAttending ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="attendeesCount"
                      className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Number of Guests
                    </label>
                    <input
                      id="attendeesCount"
                      name="attendeesCount"
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={form.attendeesCount}
                      onChange={onFieldChange}
                      className="border-b border-border bg-transparent px-1 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                  </div>

                  <fieldset className="flex flex-col gap-3">
                    <legend className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Dietary Restrictions
                    </legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {DIETARY_OPTIONS.map((option) => (
                        <label key={option} className="flex items-center gap-2 font-sans text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={form.dietaryRestrictions.includes(option)}
                            onChange={() =>
                              setForm((prev) => ({
                                ...prev,
                                dietaryRestrictions: toggleDietary(prev.dietaryRestrictions, option)
                              }))
                            }
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="dietaryNotes"
                      className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Allergies / Additional Notes
                    </label>
                    <textarea
                      id="dietaryNotes"
                      name="dietaryNotes"
                      rows={3}
                      value={form.dietaryNotes}
                      onChange={onFieldChange}
                      className="resize-y border border-border bg-transparent px-2 py-2 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                  </div>
                </>
              ) : null}

              {error ? <p className="font-sans text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 self-center border border-primary px-10 py-3 font-sans text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Submit RSVP"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
