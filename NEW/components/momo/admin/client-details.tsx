'use client'

import { useEffect, useState } from 'react'
import type { Client, ClientDeal, ClientFeatures, Coupon } from '@/lib/momo-admin-data'
import { GeneralInfoCard } from './general-info-card'
import { AnalyticsCard } from './analytics-card'
import { CouponsCard } from './coupons-card'
import { DealSettingsCard } from './deal-settings-card'
import { CredentialsCard } from './credentials-card'

export function ClientDetails({ client }: { client: Client }) {
  const [features, setFeatures] = useState<ClientFeatures>(client.features)
  const [deal, setDeal] = useState<ClientDeal>(client.deal)
  const [coupons, setCoupons] = useState<Coupon[]>(client.coupons)
  const [saved, setSaved] = useState(false)

  // Reset local state whenever a different client is selected.
  useEffect(() => {
    setFeatures(client.features)
    setDeal(client.deal)
    setCoupons(client.coupons)
    setSaved(false)
  }, [client])

  function handleFeatureChange(key: keyof ClientFeatures, value: boolean) {
    setFeatures((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleDealChange(patch: Partial<ClientDeal>) {
    setDeal((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  function handleAddCoupon(code: string, limit: number) {
    setCoupons((prev) => [...prev, { id: `cp-${Date.now()}`, code, limit, used: 0 }])
  }

  function handleRemoveCoupon(id: string) {
    setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">
          {client.partnerA} & {client.partnerB}
        </h2>
        <p className="text-sm text-muted-foreground">{client.eventName}</p>
      </div>

      <GeneralInfoCard client={client} />
      <AnalyticsCard analytics={client.analytics} />
      <CouponsCard coupons={coupons} onAdd={handleAddCoupon} onRemove={handleRemoveCoupon} />
      <DealSettingsCard
        features={features}
        deal={deal}
        onFeatureChange={handleFeatureChange}
        onDealChange={handleDealChange}
        onSave={handleSave}
        saved={saved}
      />
      <CredentialsCard client={client} />
    </div>
  )
}
