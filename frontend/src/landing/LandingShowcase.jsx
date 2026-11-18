import { useEffect, useState } from "react";
import { Bell, Users } from "lucide-react";

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

function PhoneScreenshot({ src, alt }) {
  return (
    <img
      src={encodeURI(src)}
      alt={alt}
      className="block h-auto w-full"
      draggable="false"
    />
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

export default function LandingShowcase() {
  return (
    <section id="showcase" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-serif text-3xl font-bold text-primary md:text-4xl">
            דוגמאות חיות מהמערכת
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            ההזמנה הדיגיטלית, ההזמנה בוואטסאפ — וההבדל בין וואטסאפ שנשלח מהחברה לבין וואטסאפ שנשלח
            בחינם מהמספר האישי שלכם.
          </p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          <div>
            <PhoneFrame label="שליחה מוואטסאפ החברה">
              <PhoneScreenshot
                src="/images/3 כפתורים (2).jpeg"
                alt="הודעת וואטסאפ מהחברה עם שלושה כפתורי אישור הגעה"
              />
            </PhoneFrame>
            <p className="mx-auto mt-4 max-w-[300px] text-center text-sm leading-relaxed text-muted-foreground">
              הודעה מהמספר של החברה עם כפתורי אישור מהירים — האורח לוחץ פעם אחת והתשובה נכנסת
              למערכת.
            </p>
          </div>

          <div>
            <PhoneFrame label="שליחה מהוואטסאפ האישי שלכם">
              <PhoneScreenshot
                src="/images/ווצאפ אישי.jpeg"
                alt="הודעת וואטסאפ שנשלחת מהמספר האישי"
              />
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
      </div>
    </section>
  );
}
