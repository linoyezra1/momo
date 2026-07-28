"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, X, User, Check, Database, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

/** בחירה לכל רשומה: להשאיר את הקיים או להחליף */
export type ResolveChoice = "keep" | "replace"

/** צד בהשוואה — שם + שורות מידע נוספות (כמות, סטטוס, מקור וכו') */
export type DuplicateParty = {
  name: string
  lines: string[]
}

/** התנגשות בודדת לפי מספר טלפון */
export type DuplicateConflict = {
  id: string
  phone: string
  /** תווית שורה לייבוא אקסל, למשל "שורה 2" */
  rowLabel?: string
  existing: DuplicateParty
  incoming: DuplicateParty
}

/** טקסטים מותאמים לכל מסלול */
export type DuplicateLabels = {
  title: string
  description: string
  keepTag: string
  replaceTag: string
  confirm: string
  confirmBusy: string
  cancel: string
  /** הערה נוספת (אקסל: כמה חדשים יתווספו) */
  extraNote?: string
}

type CommonProps = {
  open: boolean
  busy?: boolean
  labels: DuplicateLabels
  onCancel: () => void
}

/* ------------------------------------------------------------------ */
/* מעטפת מודל משותפת                                                    */
/* ------------------------------------------------------------------ */

function ModalShell({
  labels,
  onCancel,
  busy,
  children,
  footer,
  wide,
}: {
  labels: DuplicateLabels
  onCancel: () => void
  busy?: boolean
  children: React.ReactNode
  footer: React.ReactNode
  wide?: boolean
}) {
  // נעילת גלילת הרקע כשהמודל פתוח
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      /* לחיצה על הרקע לא סוגרת — רק כפתור ביטול */
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ${
          wide ? "max-w-lg" : "max-w-md"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
      >
        {/* כותרת */}
        <div className="flex items-start gap-3 border-b border-border p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-balance font-serif text-lg font-bold text-foreground">{labels.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{labels.description}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            aria-label={labels.cancel}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {children}

        {/* פעולות */}
        <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
          {footer}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* כרטיס בחירה (קיים מול חדש)                                          */
/* ------------------------------------------------------------------ */

function ChoiceOption({
  selected,
  onSelect,
  tag,
  icon,
  party,
  tone,
  disabled,
}: {
  selected: boolean
  onSelect: () => void
  tag: string
  icon: React.ReactNode
  party: DuplicateParty
  tone: "keep" | "replace"
  disabled?: boolean
}) {
  const active =
    tone === "keep"
      ? "border-primary bg-primary/5 ring-1 ring-primary"
      : "border-accent bg-accent/5 ring-1 ring-accent"
  const idle =
    tone === "keep" ? "border-border bg-card hover:border-primary/40" : "border-border bg-card hover:border-accent/40"
  const tagColor = tone === "keep" ? "text-muted-foreground" : "text-accent"
  const checkColor = tone === "keep" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-xl border p-3 text-right transition-colors disabled:opacity-50 ${
        selected ? active : idle
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${tagColor}`}>
          {icon}
          {tag}
        </span>
        {selected && (
          <span className={`flex size-5 items-center justify-center rounded-full ${checkColor}`}>
            <Check className="size-3" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 font-semibold text-foreground">
        <User className="size-4 text-muted-foreground" aria-hidden />
        {party.name}
      </p>
      {party.lines.map((line, i) => (
        <p key={i} className="mt-1 text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* וריאנט 1 — מודל יחיד (הוספה ידנית)                                  */
/* ------------------------------------------------------------------ */

export function SingleDuplicateModal({
  open,
  busy,
  labels,
  conflict,
  onCancel,
  onConfirm,
}: CommonProps & {
  conflict: DuplicateConflict
  /** נקרא כשבוחרים להחליף את הרשומה הקיימת */
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <ModalShell labels={labels} onCancel={onCancel} busy={busy}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy} className="rounded-full bg-transparent">
            {labels.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="rounded-full">
            <Check className="size-4" aria-hidden />
            {busy ? labels.confirmBusy : labels.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="font-semibold text-foreground">
            {conflict.phone}
          </span>
        </div>
        {/* השוואה זו לצד זו */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Database className="size-3.5" aria-hidden />
              {labels.keepTag}
            </span>
            <p className="mt-2 flex items-center gap-1.5 font-semibold text-foreground">
              <User className="size-4 text-muted-foreground" aria-hidden />
              {conflict.existing.name}
            </p>
            {conflict.existing.lines.map((line, i) => (
              <p key={i} className="mt-1 text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles className="size-3.5" aria-hidden />
              {labels.replaceTag}
            </span>
            <p className="mt-2 flex items-center gap-1.5 font-semibold text-foreground">
              <User className="size-4 text-muted-foreground" aria-hidden />
              {conflict.incoming.name}
            </p>
            {conflict.incoming.lines.map((line, i) => (
              <p key={i} className="mt-1 text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* וריאנט 2 — מודל מרוכז (אנשי קשר + אקסל)                            */
/* ------------------------------------------------------------------ */

export function ListDuplicateModal({
  open,
  busy,
  labels,
  conflicts,
  /** ברירת מחדל בטוחה: להשאיר את הקיים */
  defaultChoice = "keep",
  keepIcon,
  replaceIcon,
  onCancel,
  onConfirm,
}: CommonProps & {
  conflicts: DuplicateConflict[]
  defaultChoice?: ResolveChoice
  keepIcon: React.ReactNode
  replaceIcon: React.ReactNode
  onConfirm: (choices: Record<string, ResolveChoice>) => void
}) {
  const [choices, setChoices] = useState<Record<string, ResolveChoice>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.id, defaultChoice])),
  )

  if (!open) return null

  function setChoice(id: string, choice: ResolveChoice) {
    setChoices((prev) => ({ ...prev, [id]: choice }))
  }

  return (
    <ModalShell
      labels={labels}
      onCancel={onCancel}
      busy={busy}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy} className="rounded-full bg-transparent">
            {labels.cancel}
          </Button>
          <Button onClick={() => onConfirm(choices)} disabled={busy} className="rounded-full">
            <Check className="size-4" aria-hidden />
            {busy ? labels.confirmBusy : labels.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4 overflow-y-auto p-5" style={{ maxHeight: "50vh" }}>
        {labels.extraNote && (
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
            {labels.extraNote}
          </p>
        )}
        {conflicts.map((c) => {
          const choice = choices[c.id]
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span dir="ltr" className="font-semibold text-foreground">
                  {c.phone}
                </span>
                {c.rowLabel && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.rowLabel}</span>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ChoiceOption
                  selected={choice === "keep"}
                  onSelect={() => setChoice(c.id, "keep")}
                  tag={labels.keepTag}
                  icon={keepIcon}
                  party={c.existing}
                  tone="keep"
                  disabled={busy}
                />
                <ChoiceOption
                  selected={choice === "replace"}
                  onSelect={() => setChoice(c.id, "replace")}
                  tag={labels.replaceTag}
                  icon={replaceIcon}
                  party={c.incoming}
                  tone="replace"
                  disabled={busy}
                />
              </div>
            </div>
          )
        })}
      </div>
    </ModalShell>
  )
}
