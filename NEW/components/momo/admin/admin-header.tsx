'use client'

import { useState, type ReactNode } from 'react'
import { Plus, LogOut, Wallet, Users, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-card-foreground">{value}</p>
      </div>
    </div>
  )
}

export function AdminHeader({
  totalRevenue,
  activeClients,
  newLeads,
}: {
  totalRevenue: number
  activeClients: number
  newLeads: number
}) {
  const [refreshing, setRefreshing] = useState(false)

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 900)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מרכז ניהול אירועים</h1>
          <p className="text-sm text-muted-foreground">ניהול לקוחות, פרטי הזמנה וקישורים לדשבורד</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="lg">
            <Plus className="size-4" aria-hidden />
            לקוח חדש
          </Button>
          <Button size="lg" variant="outline">
            <LogOut className="size-4" aria-hidden />
            התנתקות
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Wallet className="size-5" aria-hidden />} label="סה״כ הכנסות" value={`₪${totalRevenue}`} />
        <StatCard icon={<Users className="size-5" aria-hidden />} label="לקוחות פעילים" value={`${activeClients}`} />
        <StatCard icon={<Inbox className="size-5" aria-hidden />} label="פניות חדשות" value={`${newLeads}`} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Inbox className="size-4 text-accent" aria-hidden />
            פניות מדף הנחיתה
          </h2>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className={refreshing ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden />
            רענון
          </Button>
        </header>
        <div className="rounded-xl border border-dashed border-border bg-background px-3 py-10 text-center">
          <p className="text-sm font-medium text-foreground">אין פניות עדיין</p>
          <p className="text-xs text-muted-foreground">פניות חדשות מדף הנחיתה יופיעו כאן אוטומטית.</p>
        </div>
      </section>
    </div>
  )
}
