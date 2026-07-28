'use client'

import { useState } from 'react'
import { Ticket, Plus, Trash2 } from 'lucide-react'
import type { Coupon } from '@/lib/momo-admin-data'
import { Button } from '@/components/ui/button'
import { SectionCard } from './ui-bits'

export function CouponsCard({
  coupons,
  onAdd,
  onRemove,
}: {
  coupons: Coupon[]
  onAdd: (code: string, limit: number) => void
  onRemove: (id: string) => void
}) {
  const [code, setCode] = useState('')
  const [limit, setLimit] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedLimit = Number.parseInt(limit, 10)
    if (!code.trim() || !Number.isFinite(parsedLimit) || parsedLimit <= 0) return
    onAdd(code.trim(), parsedLimit)
    setCode('')
    setLimit('')
  }

  return (
    <SectionCard title="מכסת וואטסאפ ללקוח (Twilio)" icon={<Ticket className="size-4 text-accent" aria-hidden />}>
      {coupons.length > 0 ? (
        <ul className="mb-4 grid gap-2">
          {coupons.map((c) => {
            const pct = c.limit > 0 ? Math.round((c.used / c.limit) * 100) : 0
            return (
              <li key={c.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">{c.code}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.used} / {c.limit}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(c.id)}
                      aria-label={`מחיקת קופון ${c.code}`}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mb-4 rounded-xl border border-dashed border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
          עדיין אין קופונים ללקוח הזה.
        </p>
      )}

      <form onSubmit={handleSubmit} className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium text-foreground">הוספת קופון נוסף ללקוח</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="קוד קופון"
            className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="numeric"
            placeholder="מכסת הודעות"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring sm:w-36"
          />
          <Button type="submit" size="lg" className="shrink-0">
            <Plus className="size-4" aria-hidden />
            הוסף
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
