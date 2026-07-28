'use client'

import { useState } from 'react'
import { Send, MessageCircle, Check } from 'lucide-react'
import type { Client } from '@/lib/momo-admin-data'
import { buildCredentialsMessage } from '@/lib/momo-admin-data'
import { Button } from '@/components/ui/button'
import { SectionCard, CopyButton } from './ui-bits'

export function CredentialsCard({ client }: { client: Client }) {
  const [sent, setSent] = useState(false)
  const message = buildCredentialsMessage(client)

  function handleSend() {
    setSent(true)
    setTimeout(() => setSent(false), 2200)
  }

  return (
    <SectionCard title="שליחת הרשאות בוואטסאפ" icon={<MessageCircle className="size-4 text-accent" aria-hidden />}>
      <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-3 text-sm text-foreground">
        שולח לזוג את תבנית ה-Quick Reply עם שם המשתמש, הסיסמה והקישורים לדשבורד ולהזמנה — ישירות לוואטסאפ שלהם.
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">תצוגה מקדימה של ההודעה</span>
          <CopyButton value={message} label="העתק הודעה ללקוח" />
        </div>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
          {message}
        </pre>
      </div>

      <Button type="button" size="lg" onClick={handleSend} className="w-full sm:w-auto">
        {sent ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {sent ? 'ההרשאות נשלחו!' : 'שלח הרשאות'}
      </Button>
    </SectionCard>
  )
}
