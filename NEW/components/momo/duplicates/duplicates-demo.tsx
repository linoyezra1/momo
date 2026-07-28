"use client"

import { useState } from "react"
import { UserPlus, Contact, FileSpreadsheet, CheckCircle2, Users, Database, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SingleDuplicateModal,
  ListDuplicateModal,
  type DuplicateConflict,
  type ResolveChoice,
} from "./duplicate-modal"

type Flow = "manual" | "contacts" | "excel" | null

/* רשומות שכבר קיימות במערכת */
const existing = [
  { phone: "0535314055", name: "שמואל", count: 2, source: "אישור הגעה עצמי" },
  { phone: "0549806179", name: "טי", count: 1, source: "הוזן ידנית" },
  { phone: "0521114488", name: "רותם", count: 3, source: "אישור הגעה עצמי" },
]

/* --- הוספה ידנית: קונפליקט יחיד --- */
const manualConflict: DuplicateConflict = {
  id: "manual",
  phone: "0549806179",
  existing: { name: "טי", lines: ["הוזן ידנית", "סטטוס: לא ידוע"] },
  incoming: { name: "טל כהן", lines: ["4 מגיעים"] },
}

/* --- ייבוא מאנשי קשר: כמה קונפליקטים, כמות תמיד 1 --- */
const contactsConflicts: DuplicateConflict[] = [
  {
    id: "c-1",
    phone: "0535314055",
    existing: { name: "שמואל", lines: ["אישר עצמאית · 2 מגיעים"] },
    incoming: { name: "שמוליק לוי", lines: ["1 מגיע", "מקור: אנשי קשר"] },
  },
  {
    id: "c-2",
    phone: "0521114488",
    existing: { name: "רותם", lines: ["אישר עצמאית · 3 מגיעים"] },
    incoming: { name: "רותם ברק", lines: ["1 מגיע", "מקור: אנשי קשר"] },
  },
]

/* --- ייבוא מאקסל: כמה קונפליקטים + שורות --- */
const excelConflicts: DuplicateConflict[] = [
  {
    id: "row-2",
    phone: "0535314055",
    rowLabel: "שורה 2",
    existing: { name: "שמואל", lines: ["כמות 2", "מקור: אישור הגעה עצמי"] },
    incoming: { name: "ישראל ישראלי", lines: ["כמות 2"] },
  },
  {
    id: "row-5",
    phone: "0549806179",
    rowLabel: "שורה 5",
    existing: { name: "טי", lines: ["כמות 1", "מקור: הוזן ידנית"] },
    incoming: { name: "טליה כהן", lines: ["כמות 5"] },
  },
]

export function DuplicatesDemo() {
  const [flow, setFlow] = useState<Flow>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  function finish(message: string) {
    setBusy(true)
    // הדמיית שמירה בשרת
    setTimeout(() => {
      setBusy(false)
      setFlow(null)
      setResult(message)
    }, 700)
  }

  function handleListConfirm(choices: Record<string, ResolveChoice>, verb: string) {
    const values = Object.values(choices)
    const replaced = values.filter((c) => c === "replace").length
    const kept = values.filter((c) => c === "keep").length
    finish(`${verb} הושלם · ${replaced} הוחלפו · ${kept} נשארו כפי שהיו`)
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-foreground">הוספת מוזמנים לרשימה</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          שלוש דרכים להוסיף מוזמנים. אם מספר טלפון כבר קיים במערכת, נפתח חלון מתאים כדי לבחור מה
          לשמור. תמיד אפשר לבטל בלי לשנות כלום.
        </p>

        {/* רשומות קיימות */}
        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
            כרגע במערכת
          </p>
          <ul className="mt-2 space-y-1.5">
            {existing.map((g) => (
              <li key={g.phone} className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{g.name}</span>
                <span dir="ltr" className="text-xs text-muted-foreground">
                  {g.phone} · כמות {g.count}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* שלושה מסלולים */}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button
            onClick={() => {
              setResult(null)
              setFlow("manual")
            }}
            className="rounded-full"
          >
            <UserPlus className="size-4" aria-hidden />
            הוספה ידנית
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null)
              setFlow("contacts")
            }}
            className="rounded-full"
          >
            <Contact className="size-4" aria-hidden />
            אנשי קשר
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null)
              setFlow("excel")
            }}
            className="rounded-full"
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            ייבוא אקסל
          </Button>
        </div>

        {result && (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <p className="text-sm font-semibold text-foreground">{result}</p>
          </div>
        )}
      </div>

      {/* 1 — הוספה ידנית: מודל יחיד */}
      <SingleDuplicateModal
        open={flow === "manual"}
        busy={busy}
        conflict={manualConflict}
        labels={{
          title: "המוזמן כבר קיים במערכת",
          description:
            "טי כבר קיים במערכת עם מספר טלפון זה (סטטוס: לא ידוע). להחליף אותו בטל כהן עם 4 מגיעים?",
          keepTag: "קיים במערכת",
          replaceTag: "חדש",
          confirm: "אישור החלפה",
          confirmBusy: "שומר…",
          cancel: "ביטול",
        }}
        onCancel={() => setFlow(null)}
        onConfirm={() => finish("המוזמן הוחלף בהצלחה")}
      />

      {/* 2 — אנשי קשר: מודל מרוכז, ברירת מחדל דלג */}
      <ListDuplicateModal
        open={flow === "contacts"}
        busy={busy}
        conflicts={contactsConflicts}
        defaultChoice="keep"
        keepIcon={<Database className="size-3.5" aria-hidden />}
        replaceIcon={<Contact className="size-3.5" aria-hidden />}
        labels={{
          title: "המוזמן כבר קיים במערכת",
          description: "נמצאו 2 אנשי קשר עם מספר טלפון שכבר קיים במערכת. בחרו לכל אחד האם לדלג או להחליף.",
          keepTag: "דלג — השאר קיים",
          replaceTag: "אישור החלפה",
          confirm: "המשך ייבוא",
          confirmBusy: "מייבא…",
          cancel: "ביטול",
        }}
        onCancel={() => setFlow(null)}
        onConfirm={(choices) => handleListConfirm(choices, "הייבוא מאנשי קשר")}
      />

      {/* 3 — אקסל: מודל מרוכז, ברירת מחדל השאר קיים */}
      <ListDuplicateModal
        open={flow === "excel"}
        busy={busy}
        conflicts={excelConflicts}
        defaultChoice="keep"
        keepIcon={<Database className="size-3.5" aria-hidden />}
        replaceIcon={<Sparkles className="size-3.5" aria-hidden />}
        labels={{
          title: "נמצאו מוזמנים עם מספר טלפון קיים",
          description:
            "זוהו 2 רשומות חופפות. בחרו לכל רשומה האם להשאיר את הקיים או לעדכן לפי האקסל, ואז לחצו אישור.",
          extraNote: "בנוסף, 8 מוזמנים חדשים יתווספו אוטומטית עם האישור.",
          keepTag: "השאר את הקיים",
          replaceTag: "עדכן לפי האקסל",
          confirm: "אשר והמשך שמירה",
          confirmBusy: "שומר…",
          cancel: "ביטול",
        }}
        onCancel={() => setFlow(null)}
        onConfirm={(choices) => handleListConfirm(choices, "הייבוא מאקסל")}
      />
    </div>
  )
}
