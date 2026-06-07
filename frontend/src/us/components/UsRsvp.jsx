import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Frown, Heart } from "lucide-react";
import api from "../../api.js";

const DIETARY_OPTIONS = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy"];
const ATTENDANCE_OPTIONS = [
  {
    value: "Joyfully Accepts",
    label: "Joyfully Accepts",
    sublabel: "Count me in!",
    Icon: Heart,
    selectedClass: "border-green-400 bg-[#e6f4ea] text-[#4a2e2b] shadow-sm",
    iconSelectedClass: "text-green-600",
    unselectedClass: "border-[#e8e0d8] bg-[#fdfbf7] text-[#4a2e2b]/80 hover:border-green-200",
    iconUnselectedClass: "text-green-600/45"
  },
  {
    value: "Regretfully Declines",
    label: "Regretfully Declines",
    sublabel: "Can't make it",
    Icon: Frown,
    selectedClass: "border-red-400 bg-[#fce8e6] text-[#4a2e2b] shadow-sm",
    iconSelectedClass: "text-red-500",
    unselectedClass: "border-[#e8e0d8] bg-[#fdfbf7] text-[#4a2e2b]/80 hover:border-red-200",
    iconUnselectedClass: "text-red-400/45"
  }
];
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

export default function UsRsvp({ event, slug, previewMode = false }) {
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (eventKey) => {
      if (eventKey.key === "Escape") {
        setModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || "unset";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen]);

  function onFieldChange(eventChange) {
    const { name, value } = eventChange.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function selectAttendanceStatus(status) {
    setForm((prev) => ({ ...prev, status }));
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
              onClick={previewMode ? undefined : openModal}
              disabled={previewMode}
              className="mt-12 border border-primary px-10 py-3 font-sans text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-default disabled:opacity-80"
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

      {!previewMode && modalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-6 backdrop-blur-sm"
              onClick={closeModal}
              role="presentation"
            >
              <div
                className="my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-sm border border-border bg-card p-8 shadow-lg"
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

              <fieldset className="flex flex-col gap-3">
                <legend className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">Attendance</legend>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Attendance">
                  {ATTENDANCE_OPTIONS.map((option) => {
                    const selected = form.status === option.value;
                    const OptionIcon = option.Icon;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => selectAttendanceStatus(option.value)}
                        className={`flex flex-col items-center justify-center gap-2.5 rounded-sm border-2 px-2 py-5 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          selected ? option.selectedClass : option.unselectedClass
                        }`}
                      >
                        <OptionIcon
                          className={`h-8 w-8 ${selected ? option.iconSelectedClass : option.iconUnselectedClass}`}
                          strokeWidth={1.5}
                          fill={selected ? "currentColor" : "none"}
                          aria-hidden="true"
                        />
                        <span className="font-serif text-[0.68rem] uppercase leading-snug tracking-[0.12em] sm:text-xs sm:tracking-[0.15em]">
                          {option.label}
                        </span>
                        <span className="font-sans text-[0.65rem] normal-case tracking-normal text-muted-foreground">
                          {option.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

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
            </div>,
            document.body
          )
        : null}
    </>
  );
}
