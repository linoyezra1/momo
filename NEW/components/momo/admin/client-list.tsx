'use client'

import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import type { Client } from '@/lib/momo-admin-data'
import { cn } from '@/lib/utils'

export function ClientList({
  clients,
  selectedId,
  onSelect,
}: {
  clients: Client[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) =>
      `${c.partnerA} ${c.partnerB} ${c.phone}`.toLowerCase().includes(q),
    )
  }, [clients, query])

  return (
    <aside className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-card-foreground">
          <Users className="size-4 text-accent" aria-hidden />
          לקוחות פעילים
          <span className="mr-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {clients.length}
          </span>
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לקוח לפי שם או טלפון"
            aria-label="חיפוש לקוח"
            className="h-9 w-full rounded-lg border border-border bg-background pr-9 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">לא נמצאו לקוחות</li>
        ) : (
          filtered.map((c) => {
            const active = c.id === selectedId
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'mb-1 flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-right transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  <span className="text-sm font-medium">
                    {c.partnerA} & {c.partnerB}
                  </span>
                  <span className={cn('text-xs', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {c.phone}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )
}
