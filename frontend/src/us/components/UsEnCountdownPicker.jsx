const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function to12Hour(hour24) {
  const hour = Number(hour24) || 0;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return { hour12: String(hour12), ampm };
}

function to24Hour(hour12, ampm) {
  let hour = Number(hour12) || 12;
  if (ampm === "AM") {
    return hour === 12 ? 0 : hour;
  }
  return hour === 12 ? 12 : hour + 12;
}

function parseValue(value) {
  if (!value) {
    return { month: "", day: "", year: "", hour12: "3", minute: "30", ampm: "PM" };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { month: "", day: "", year: "", hour12: "3", minute: "30", ampm: "PM" };
  }

  const { hour12, ampm } = to12Hour(parsed.getHours());

  return {
    month: MONTHS[parsed.getMonth()],
    day: String(parsed.getDate()),
    year: String(parsed.getFullYear()),
    hour12,
    minute: pad2(parsed.getMinutes()),
    ampm
  };
}

function toLocalDateTimeValue({ month, day, year, hour12, minute, ampm }) {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex < 0 || !day || !year) return "";

  const local = new Date(
    Number(year),
    monthIndex,
    Number(day),
    to24Hour(hour12, ampm),
    Number(minute || 0),
    0,
    0
  );

  if (Number.isNaN(local.getTime())) return "";

  return `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}T${pad2(local.getHours())}:${pad2(local.getMinutes())}`;
}

export default function UsEnCountdownPicker({ value, onChange, required = false }) {
  const parts = parseValue(value);

  function update(patch) {
    const next = { ...parts, ...patch };
    onChange(toLocalDateTimeValue(next));
  }

  const daysInMonth =
    parts.month && parts.year
      ? new Date(Number(parts.year), MONTHS.indexOf(parts.month) + 1, 0).getDate()
      : 31;

  return (
    <div className="us-en-countdown-picker" lang="en-US">
      <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Wedding Date &amp; Time (Countdown)
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 font-sans text-sm">
          Month *
          <select
            className="border border-border bg-transparent px-3 py-2"
            value={parts.month}
            onChange={(event) => update({ month: event.target.value })}
            required={required}
          >
            <option value="">Select month</option>
            {MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 font-sans text-sm">
          Day *
          <select
            className="border border-border bg-transparent px-3 py-2"
            value={parts.day}
            onChange={(event) => update({ day: event.target.value })}
            required={required}
          >
            <option value="">Day</option>
            {Array.from({ length: daysInMonth }, (_, index) => String(index + 1)).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 font-sans text-sm">
          Year *
          <input
            className="border border-border bg-transparent px-3 py-2"
            type="number"
            min="2024"
            max="2100"
            placeholder="2027"
            value={parts.year}
            onChange={(event) => update({ year: event.target.value })}
            required={required}
          />
        </label>

        <label className="flex flex-col gap-2 font-sans text-sm">
          Time *
          <div className="flex items-center gap-2">
            <select
              className="w-full border border-border bg-transparent px-2 py-2"
              value={parts.hour12}
              onChange={(event) => update({ hour12: event.target.value })}
              required={required}
            >
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
            <span>:</span>
            <select
              className="w-full border border-border bg-transparent px-2 py-2"
              value={parts.minute}
              onChange={(event) => update({ minute: event.target.value })}
              required={required}
            >
              {Array.from({ length: 60 }, (_, index) => pad2(index)).map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </select>
            <select
              className="border border-border bg-transparent px-2 py-2"
              value={parts.ampm}
              onChange={(event) => update({ ampm: event.target.value })}
              required={required}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </label>
      </div>
    </div>
  );
}
