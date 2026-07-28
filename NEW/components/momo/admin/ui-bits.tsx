'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SectionCard({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-5 shadow-sm', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-card-foreground">
          {icon}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}

export function CopyButton({
  value,
  label = 'העתק',
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted',
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-accent" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'הועתק!' : label}
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted/60">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 transform rounded-full bg-card shadow transition-transform',
            // RTL: checked slides toward the start (right)
            checked ? 'translate-x-[-2px]' : 'translate-x-[-22px]',
          )}
        />
      </button>
    </label>
  )
}

export function StatusBadge({ status }: { status: 'delivered' | 'pending' | 'failed' }) {
  const map = {
    delivered: { label: 'נמסרו', cls: 'bg-accent/15 text-accent border-accent/30' },
    pending: { label: 'ממתין', cls: 'bg-muted text-muted-foreground border-border' },
    failed: { label: 'נכשלו', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  } as const
  const item = map[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', item.cls)}>
      {item.label}
    </span>
  )
}
