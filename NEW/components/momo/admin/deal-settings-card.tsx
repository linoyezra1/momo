'use client'

import { Settings2, Check } from 'lucide-react'
import {
  type ClientDeal,
  type ClientFeatures,
  type PackageType,
  type PaymentMethod,
  PACKAGE_LABELS,
  PAYMENT_LABELS,
} from '@/lib/momo-admin-data'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SectionCard, Toggle } from './ui-bits'

const FEATURE_LIST: { key: keyof ClientFeatures; label: string; hint?: string }[] = [
  { key: 'whatsappRound1', label: 'וואטסאפ — סבב 1' },
  { key: 'whatsappRound2', label: 'וואטסאפ — סבב 2' },
  { key: 'quickReplyButtons', label: 'וואטסאפ כפתורים מהירים', hint: 'Premium' },
  { key: 'calls1', label: 'שיחות טלפון — סבב 1' },
  { key: 'calls2', label: 'שיחות טלפון — סבב 2' },
  { key: 'calls3', label: 'שיחות טלפון — סבב 3' },
  { key: 'calls4', label: 'שיחות טלפון — סבב 4' },
  { key: 'eventDayReminder', label: 'תזכורת ביום האירוע' },
  { key: 'tableNumberWhatsapp', label: 'שליחת מספר שולחן (WhatsApp)' },
  { key: 'tableNumberHostess', label: 'שליחת מספר שולחן (דיילת)' },
  { key: 'thankYouMessage', label: 'הודעת תודה' },
]

export function DealSettingsCard({
  features,
  deal,
  onFeatureChange,
  onDealChange,
  onSave,
  saved,
}: {
  features: ClientFeatures
  deal: ClientDeal
  onFeatureChange: (key: keyof ClientFeatures, value: boolean) => void
  onDealChange: (patch: Partial<ClientDeal>) => void
  onSave: () => void
  saved: boolean
}) {
  return (
    <SectionCard title="פרטי עסקה ושיווק" icon={<Settings2 className="size-4 text-accent" aria-hidden />}>
      {/* Package selection */}
      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-foreground">סוג חבילה</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PACKAGE_LABELS) as PackageType[]).map((pkg) => {
            const active = deal.package === pkg
            return (
              <button
                key={pkg}
                type="button"
                onClick={() => onDealChange({ package: pkg })}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
                )}
              >
                {PACKAGE_LABELS[pkg]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Features */}
      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-foreground">
          פיצ׳רים וסבבים כלולים <span className="text-xs text-muted-foreground">(SYSTEM_ADMIN)</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURE_LIST.map((f) => (
            <Toggle
              key={f.key}
              label={f.label}
              hint={f.hint}
              checked={features[f.key]}
              onChange={(v) => onFeatureChange(f.key, v)}
            />
          ))}
        </div>
      </div>

      {/* Payment details */}
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">מקור שיווקי</span>
          <input
            value={deal.marketingSource}
            onChange={(e) => onDealChange({ marketingSource: e.target.value })}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">סכום ששולם (₪)</span>
          <input
            value={deal.amountPaid}
            onChange={(e) => onDealChange({ amountPaid: Number.parseInt(e.target.value, 10) || 0 })}
            inputMode="numeric"
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">אמצעי תשלום</span>
          <select
            value={deal.paymentMethod}
            onChange={(e) => onDealChange({ paymentMethod: e.target.value as PaymentMethod })}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          >
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">הערות מנהל</span>
          <textarea
            value={deal.adminNotes}
            onChange={(e) => onDealChange({ adminNotes: e.target.value })}
            rows={2}
            className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" size="lg" onClick={onSave}>
          {saved ? <Check className="size-4" aria-hidden /> : null}
          {saved ? 'נשמר בהצלחה' : 'שמירת פרטי עסקה'}
        </Button>
      </div>
    </SectionCard>
  )
}
