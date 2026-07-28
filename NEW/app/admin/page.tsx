'use client'

import { useMemo, useState } from 'react'
import { CLIENTS } from '@/lib/momo-admin-data'
import { AdminHeader } from '@/components/momo/admin/admin-header'
import { ClientList } from '@/components/momo/admin/client-list'
import { ClientDetails } from '@/components/momo/admin/client-details'

export default function AdminPage() {
  const [selectedId, setSelectedId] = useState(CLIENTS[0].id)

  const selectedClient = useMemo(
    () => CLIENTS.find((c) => c.id === selectedId) ?? CLIENTS[0],
    [selectedId],
  )

  const totalRevenue = useMemo(() => CLIENTS.reduce((sum, c) => sum + c.deal.amountPaid, 0), [])

  return (
    <main dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <AdminHeader totalRevenue={totalRevenue} activeClients={CLIENTS.length} newLeads={0} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
            <ClientList clients={CLIENTS} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <ClientDetails key={selectedClient.id} client={selectedClient} />
        </div>
      </div>
    </main>
  )
}
