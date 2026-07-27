"use client"

import { useMemo, useState } from "react"
import { Search, Check, MapPin, Send, Armchair, X, Users, CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

type Status = "מגיע" | "אולי" | "לא ידוע"

type Guest = {
  id: number
  name: string
  phone: string
  table: number | null
  status: Status
  arrived: boolean
}

const initialGuests: Guest[] = [
  { id: 1, name: "אאוראל", phone: "0535314482", table: null, status: "לא ידוע", arrived: false },
  { id: 2, name: "אורון", phone: "0537370403", table: 5, status: "לא ידוע", arrived: false },
  { id: 3, name: "איציק", phone: "0502116638", table: null, status: "לא ידוע", arrived: false },
  { id: 4, name: "טי", phone: "0549806179", table: 5, status: "אולי", arrived: false },
  { id: 5, name: "מעיין", phone: "0558811884", table: null, status: "לא ידוע", arrived: false },
  { id: 6, name: "שמואל", phone: "0535314055", table: null, status: "מגיע", arrived: false },
]

// שולחנות עם כמות פנויים לדוגמה
const tables = [
  { number: 1, free: 0 },
  { number: 2, free: 3 },
  { number: 3, free: 5 },
  { number: 4, free: 1 },
  { number: 5, free: 2 },
  { number: 6, free: 8 },
  { number: 7, free: 4 },
  { number: 8, free: 0 },
  { number: 9, free: 6 },
  { number: 10, free: 2 },
  { number: 11, free: 7 },
  { number: 12, free: 3 },
]

function statusStyle(status: Status) {
  switch (status) {
    case "מגיע":
      return "bg-accent/15 text-accent"
    case "אולי":
      return "bg-secondary text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function HostessConsole() {
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [query, setQuery] = useState("")
  const [seating, setSeating] = useState<Guest | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return guests
    return guests.filter((g) => g.name.includes(q) || g.phone.includes(q))
  }, [guests, query])

  const arrivedCount = guests.filter((g) => g.arrived).length

  function toggleArrived(id: number) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, arrived: !g.arrived } : g)))
  }

  function assignTable(id: number, table: number) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, table } : g)))
    setSeating(null)
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* מסגרת מכשיר */}
      <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
        {/* כותרת המסך */}
        <div className="bg-primary px-5 pb-5 pt-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-70">שלום, דיילת</p>
              <h3 className="font-serif text-lg font-bold">קבלת פנים · חתונה של דנה ויוסי</h3>
            </div>
            <div className="flex flex-col items-center rounded-2xl bg-primary-foreground/10 px-3 py-2">
              <span className="text-lg font-bold leading-none">{arrivedCount}</span>
              <span className="text-[10px] opacity-70">הגיעו</span>
            </div>
          </div>

          {/* חיפוש */}
          <div className="mt-4 flex items-center gap-2 rounded-full bg-primary-foreground px-4 py-2.5 text-foreground">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם או טלפון..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="חיפוש מוזמן"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="נקה חיפוש">
                <X className="size-4 text-muted-foreground" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* רשימת מוזמנים */}
        <div className="max-h-[520px] space-y-3 overflow-y-auto bg-background p-4">
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">לא נמצאו מוזמנים</p>
          )}

          {filtered.map((g) => (
            <div
              key={g.id}
              className={`rounded-2xl border bg-card p-4 transition-colors ${
                g.arrived ? "border-accent/40" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-semibold text-foreground">{g.name}</h4>
                    {g.arrived && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                        <CircleCheck className="size-3" aria-hidden />
                        הגיע
                      </span>
                    )}
                  </div>
                  <p dir="ltr" className="mt-0.5 text-right text-xs text-muted-foreground">
                    {g.phone}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        g.table ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Armchair className="size-3" aria-hidden />
                      {g.table ? `שולחן ${g.table}` : "ללא שולחן"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${statusStyle(g.status)}`}>
                      {g.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* פעולות */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={g.arrived ? "outline" : "default"}
                  onClick={() => toggleArrived(g.id)}
                  className="h-8 rounded-full text-xs"
                >
                  <Check className="size-3.5" aria-hidden />
                  {g.arrived ? "בטל הגעה" : "המוזמן הגיע"}
                </Button>

                {!g.table && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSeating(g)}
                    className="h-8 rounded-full text-xs"
                  >
                    <Armchair className="size-3.5" aria-hidden />
                    הושבה בשולחן ריק
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full text-xs text-accent hover:bg-accent/10 hover:text-accent"
                >
                  <Send className="size-3.5" aria-hidden />
                  שלח מס׳ שולחן ב-WhatsApp
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* פופאפ בחירת שולחן */}
      {seating && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-4 sm:items-center"
          onClick={() => setSeating(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`בחירת שולחן עבור ${seating.name}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">בחירת שולחן</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  הושבת <span className="font-medium text-foreground">{seating.name}</span> בשולחן פנוי
                </p>
              </div>
              <button
                onClick={() => setSeating(null)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
                aria-label="סגירה"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {tables.map((t) => {
                const full = t.free === 0
                return (
                  <button
                    key={t.number}
                    disabled={full}
                    onClick={() => assignTable(seating.id, t.number)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-colors ${
                      full
                        ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
                        : "border-border bg-background hover:border-accent hover:bg-accent/5"
                    }`}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {t.number}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="size-3" aria-hidden />
                      {full ? "מלא" : `${t.free} פנויים`}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 text-accent" aria-hidden />
              רק שולחנות עם מקום פנוי ניתנים לבחירה
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
