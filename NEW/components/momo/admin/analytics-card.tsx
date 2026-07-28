'use client'

import { MessageCircle, PhoneCall, TrendingUp } from 'lucide-react'
import type { ClientAnalytics } from '@/lib/momo-admin-data'
import { SectionCard, StatusBadge } from './ui-bits'

function Progress({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function AnalyticsCard({ analytics }: { analytics: ClientAnalytics }) {
  const {
    whatsappDelivered,
    whatsappPending,
    whatsappFailed,
    whatsappTotal,
    callsRound1,
    callsRound1Total,
    callsRound2,
    callsRound2Total,
  } = analytics

  const deliveredPct = whatsappTotal > 0 ? Math.round((whatsappDelivered / whatsappTotal) * 100) : 0

  return (
    <SectionCard title="סטטיסטיקת שימוש בהודעות ושיחות" icon={<TrendingUp className="size-4 text-accent" aria-hidden />}>
      <div className="grid gap-4">
        {/* WhatsApp delivered */}
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageCircle className="size-4 text-accent" aria-hidden />
              הודעות וואטסאפ שנשלחו
            </span>
            <span className="text-2xl font-bold text-foreground">{whatsappDelivered}</span>
          </div>
          <Progress value={whatsappDelivered} total={whatsappTotal} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{deliveredPct}% מתוך {whatsappTotal}</span>
            <div className="mr-auto flex items-center gap-2">
              <StatusBadge status="delivered" />
              <span className="text-xs text-muted-foreground">{whatsappDelivered}</span>
              <StatusBadge status="pending" />
              <span className="text-xs text-muted-foreground">{whatsappPending}</span>
              <StatusBadge status="failed" />
              <span className="text-xs text-muted-foreground">{whatsappFailed}</span>
            </div>
          </div>
        </div>

        {/* Calls */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PhoneCall className="size-4 text-accent" aria-hidden />
                שיחות — סבב 1
              </span>
              <span className="text-xl font-bold text-foreground">{callsRound1}</span>
            </div>
            <Progress value={callsRound1} total={callsRound1Total} />
            <p className="mt-2 text-xs text-muted-foreground">בוצעו {callsRound1} מתוך {callsRound1Total}</p>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PhoneCall className="size-4 text-accent" aria-hidden />
                שיחות — סבב 2
              </span>
              <span className="text-xl font-bold text-foreground">{callsRound2}</span>
            </div>
            <Progress value={callsRound2} total={callsRound2Total} />
            <p className="mt-2 text-xs text-muted-foreground">בוצעו {callsRound2} מתוך {callsRound2Total}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
