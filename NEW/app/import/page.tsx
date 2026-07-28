import Link from "next/link"
import { ArrowRight, FileSpreadsheet } from "lucide-react"
import { DuplicatesDemo } from "@/components/momo/duplicates/duplicates-demo"

export default function ImportPage() {
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
            <FileSpreadsheet className="size-3.5" aria-hidden />
            הצעת עיצוב · טיפול בכפילויות
          </span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-balance font-serif text-3xl font-bold text-foreground">
            טיפול במוזמנים כפולים
          </h1>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            כשמוסיפים מוזמן שכבר קיים במערכת - בהוספה ידנית, מאנשי קשר או מייבוא אקסל - נפתח החלון
            המתאים כדי לבחור מה לשמור. נסו את שלושת המסלולים.
          </p>
        </div>

        <DuplicatesDemo />
      </div>
    </main>
  )
}
