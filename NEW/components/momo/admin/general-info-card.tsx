'use client'

import type { ReactNode } from 'react'
import {
  Calendar,
  MapPin,
  Mail,
  Clock,
  Phone,
  User,
  KeyRound,
  ShoppingBag,
  Link2,
  CalendarDays,
} from 'lucide-react'
import type { Client } from '@/lib/momo-admin-data'
import { SectionCard, CopyButton } from './ui-bits'

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function GeneralInfoCard({ client }: { client: Client }) {
  return (
    <SectionCard title="פרטי אירוע וקישורים" icon={<CalendarDays className="size-4 text-accent" aria-hidden />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoRow icon={<Calendar className="size-4" aria-hidden />} label="שם האירוע" value={client.eventName} />
        <InfoRow icon={<Calendar className="size-4" aria-hidden />} label="תאריך" value={formatDate(client.eventDate)} />
        <InfoRow icon={<MapPin className="size-4" aria-hidden />} label="מיקום" value={client.location} />
        <InfoRow icon={<ShoppingBag className="size-4" aria-hidden />} label="מספר הזמנה (Etsy)" value={client.etsyOrderId} />
        <InfoRow icon={<Mail className="size-4" aria-hidden />} label="אימייל" value={client.email} />
        <InfoRow icon={<Clock className="size-4" aria-hidden />} label="תאריך יצירה" value={formatDate(client.createdAt)} />
        <InfoRow icon={<Phone className="size-4" aria-hidden />} label="טלפון ליצירת קשר" value={client.phone} />
        <InfoRow icon={<User className="size-4" aria-hidden />} label="שם משתמש" value={client.username} />
        <InfoRow icon={<KeyRound className="size-4" aria-hidden />} label="סיסמה" value={client.password} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <a
          href={client.inviteLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Link2 className="size-4" aria-hidden />
          קישור הזמנה
        </a>
        <CopyButton value={client.inviteLink} label="העתק קישור הזמנה" className="py-2" />
        <a
          href={client.dashboardLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Link2 className="size-4" aria-hidden />
          קישור דשבורד
        </a>
        <CopyButton value={client.dashboardLink} label="העתק קישור דשבורד" className="py-2" />
      </div>
    </SectionCard>
  )
}
