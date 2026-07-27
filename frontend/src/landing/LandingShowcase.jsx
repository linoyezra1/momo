import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  MapPin,
  Send,
  UserRound,
  Users
} from "lucide-react";

function PhoneFrame({ children, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border-[10px] border-primary bg-primary p-0 shadow-xl">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-primary" />
        <div className="overflow-hidden rounded-[1.7rem] bg-background">{children}</div>
      </div>
      <span className="mt-4 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function CompanyInvite() {
  return (
    <div className="flex h-[520px] flex-col bg-secondary/60">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Building2 className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">מומו · אישורי הגעה</p>
          <p className="text-xs opacity-70">חשבון עסקי</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-card p-3 shadow-sm">
          <div className="mb-2 overflow-hidden rounded-xl border border-border">
            <div className="bg-accent/12 px-3 py-4 text-center">
              <p className="font-serif text-sm font-bold text-primary">דנה &amp; יואב מתחתנים!</p>
              <p className="mt-1 text-xs text-muted-foreground">נשמח לחגוג יחד</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            היי רותם, מוזמנים לחתונה שלנו. אפשר לאשר הגעה כאן למטה:
          </p>
          <div className="mt-1 flex justify-start gap-1 text-[10px] text-muted-foreground">
            <span>20:14</span>
            <CheckCheck className="size-3.5 text-accent" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" className="rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-accent-foreground shadow-sm">
            מגיע/ה בשמחה
          </button>
          <button type="button" className="rounded-xl border border-border bg-card py-2.5 text-center text-sm font-semibold text-primary">
            לא נוכל להגיע
          </button>
          <button type="button" className="rounded-xl border border-border bg-card py-2.5 text-center text-sm font-semibold text-primary">
            עדיין לא בטוח/ה
          </button>
        </div>

        <p className="mt-1 text-center text-xs text-muted-foreground">
          כפתורי אישור מהירים — לחיצה אחת וזהו
        </p>
      </div>
    </div>
  );
}

function PersonalInvite() {
  return (
    <div className="flex h-[520px] flex-col bg-secondary/60">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex size-9 items-center justify-center rounded-full bg-card text-primary">
          <UserRound className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">אתם · הוואטסאפ האישי</p>
          <p className="text-xs opacity-70">מהמספר שלכם</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="mx-auto rounded-full bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
          נשלח מהמספר האישי שלכם
        </div>

        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-accent/15 p-3 shadow-sm">
          <p className="text-sm leading-relaxed text-foreground">
            היי רותם! 🤍 אנחנו מתחתנים ורוצים אתכם איתנו. תכף שולחים את ההזמנה עם כל הפרטים
            והלינק לאישור.
          </p>
          <div className="mt-1 flex justify-end gap-1 text-[10px] text-muted-foreground">
            <span>19:02</span>
            <CheckCheck className="size-3.5 text-accent" />
          </div>
        </div>

        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-accent/15 p-3 shadow-sm">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="bg-accent/12 px-3 py-5 text-center">
              <Calendar className="mx-auto mb-1 size-5 text-accent" />
              <p className="font-serif text-sm font-bold text-primary">ההזמנה הדיגיטלית</p>
              <p className="mt-1 text-xs text-muted-foreground">12.09 · אולם הגן · 19:30</p>
            </div>
            <div className="border-t border-border px-3 py-2 text-center text-xs font-semibold text-accent">
              לחצו לאישור הגעה
            </div>
          </div>
          <div className="mt-1 flex justify-end gap-1 text-[10px] text-muted-foreground">
            <span>19:02</span>
            <Check className="size-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

const allLogs = [
  { name: "רותם לוי", status: "מגיע", guests: "2 אורחים", time: "עכשיו" },
  { name: "משפחת כהן", status: "מגיע", guests: "4 אורחים", time: "לפני דקה" },
  { name: "נועה בר", status: "אולי", guests: "1 אורח", time: "לפני 3 דק׳" },
  { name: "איתי מזרחי", status: "לא מגיע", guests: "—", time: "לפני 5 דק׳" },
  { name: "שירה פרץ", status: "מגיע", guests: "2 אורחים", time: "לפני 8 דק׳" },
  { name: "דוד אברהם", status: "מגיע", guests: "3 אורחים", time: "לפני 12 דק׳" }
];

const statusStyle = {
  מגיע: "bg-accent/15 text-accent",
  אולי: "bg-secondary text-muted-foreground",
  "לא מגיע": "bg-muted text-muted-foreground"
};

function UpdatesLog() {
  const [count, setCount] = useState(1);
  const [confirmed, setConfirmed] = useState(148);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c >= allLogs.length ? 1 : c + 1));
      setConfirmed((n) => n + Math.floor(Math.random() * 3));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const visible = allLogs.slice(0, count);

  return (
    <div className="flex h-[520px] flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-accent" />
          <p className="text-sm font-semibold text-primary">לוג עדכונים חי</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-accent" />
          מתעדכן אונליין
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="font-serif text-2xl font-bold text-accent">{confirmed}</p>
          <p className="text-xs text-muted-foreground">אישרו הגעה</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="font-serif text-2xl font-bold text-primary">312</p>
          <p className="text-xs text-muted-foreground">סה״כ הוזמנו</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden px-4 pb-4">
        {visible.map((item, i) => (
          <div
            key={item.name}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            style={{ animation: i === 0 ? "momoSlideIn 420ms ease-out" : undefined }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Users className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-primary">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.guests} · {item.time}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[item.status]}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopDashboard() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
          <span className="size-3 rounded-full bg-accent/60" />
          <span className="size-3 rounded-full bg-muted-foreground/30" />
          <span className="size-3 rounded-full bg-muted-foreground/30" />
          <div className="mr-3 flex-1 rounded-full bg-card px-3 py-1 text-center text-xs text-muted-foreground">
            momo.co.il/dashboard
          </div>
        </div>

        <div className="p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl font-bold text-primary">החתונה של דנה &amp; יואב</h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                אולם הגן · 12 בספטמבר
              </p>
            </div>
            <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
              שליחת תזכורת
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { n: "312", t: "הוזמנו" },
              { n: "148", t: "אישרו" },
              { n: "36", t: "לא מגיעים" },
              { n: "128", t: "טרם ענו" }
            ].map((s) => (
              <div key={s.t} className="rounded-xl border border-border bg-background p-4 text-center">
                <p className="font-serif text-2xl font-bold text-primary">{s.n}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">התקדמות אישורים</p>
              <span className="text-sm text-muted-foreground">47%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[47%] rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        לוח הבקרה שלכם במחשב — כל הנתונים במקום אחד, מתעדכן בזמן אמת.
      </p>
    </div>
  );
}

export default function LandingShowcase() {
  return (
    <section id="showcase" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Send className="size-4 text-accent" />
            ככה זה נראה באמת
          </span>
          <h2 className="mt-5 text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
            דוגמאות חיות מהמערכת
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            ההזמנה הדיגיטלית, כפתורי האישור בוואטסאפ, ולוג עדכונים שמתעדכן לכם בזמן אמת. הכל פשוט
            וברור.
          </p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          <div>
            <PhoneFrame label="שליחה מוואטסאפ החברה">
              <CompanyInvite />
            </PhoneFrame>
            <p className="mx-auto mt-4 max-w-[300px] text-center text-sm leading-relaxed text-muted-foreground">
              הודעה מהמספר של החברה עם כפתורי אישור מהירים — האורח לוחץ פעם אחת והתשובה נכנסת
              למערכת.
            </p>
          </div>

          <div>
            <PhoneFrame label="שליחה מהוואטסאפ האישי שלכם">
              <PersonalInvite />
            </PhoneFrame>
            <p className="mx-auto mt-4 max-w-[300px] text-center text-sm leading-relaxed text-muted-foreground">
              אותה הזמנה, אבל מהמספר האישי שלכם — יותר חם ואישי, וזה בחינם לגמרי.
            </p>
          </div>

          <div>
            <PhoneFrame label="לוג עדכונים בזמן אמת">
              <UpdatesLog />
            </PhoneFrame>
            <p className="mx-auto mt-4 max-w-[300px] text-center text-sm leading-relaxed text-muted-foreground">
              כל אישור שנכנס מופיע כאן מיד. רואים כמה אישרו, כמה אורחים, ומי עוד לא ענה.
            </p>
          </div>
        </div>

        <div className="mt-16">
          <DesktopDashboard />
        </div>
      </div>
    </section>
  );
}
