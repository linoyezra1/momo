import Link from "next/link"
import { ArrowRight, Armchair } from "lucide-react"
import { HostessConsole } from "@/components/momo/hostess-console"

export default function DailetPage() {
  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="size-4" aria-hidden />
            חזרה לעמוד הבית
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            <Armchair className="size-3.5" aria-hidden />
            הצעת עיצוב · ממשק דיילת
          </span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-balance font-serif text-3xl font-bold text-foreground">
            ממשק הדיילת הדיגיטלית
          </h1>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            מחפשים אורח, מסמנים שהגיע, ומושיבים אותו בשולחן פנוי בלחיצה. נסו בעצמכם - חפשו שם, לחצו
            "הושבה בשולחן ריק" ובחרו שולחן.
          </p>
        </div>

        <HostessConsole />
      </div>
    </main>
  )
}
