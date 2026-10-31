const DAY_TO_SCHEMA: Record<string, string> = {
  domingo: "Sunday",
  dom: "Sunday",
  sun: "Sunday",
  sunday: "Sunday",
  lunes: "Monday",
  lun: "Monday",
  mon: "Monday",
  monday: "Monday",
  martes: "Tuesday",
  mar: "Tuesday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  miercoles: "Wednesday",
  miércoles: "Wednesday",
  mie: "Wednesday",
  mié: "Wednesday",
  wed: "Wednesday",
  wednesday: "Wednesday",
  jueves: "Thursday",
  jue: "Thursday",
  thu: "Thursday",
  thur: "Thursday",
  thursday: "Thursday",
  viernes: "Friday",
  vie: "Friday",
  fri: "Friday",
  friday: "Friday",
  sabado: "Saturday",
  sábado: "Saturday",
  sab: "Saturday",
  sáb: "Saturday",
  sat: "Saturday",
  saturday: "Saturday",
};

const WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const CLOSED = /\b(cerrado|closed)\b/i;
const DAY_TOKEN = "domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|sunday|monday|tuesday|wednesday|thursday|friday|saturday|dom|lun|mar|mié|mie|jue|vie|sáb|sab|sun|mon|tue|tues|wed|thu|thur|fri|sat";

function clean(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function to24h(raw: string, meridiem?: "am" | "pm"): string | null {
  const text = clean(raw).replace(/\./g, "").toLowerCase();
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap]m)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = (match[4] as "am" | "pm" | undefined) ?? meridiem;
  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return null;
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function splitRange(value: string) {
  return value.split(/\s*[–—-]\s*/).map(clean).filter(Boolean);
}

function parseClockPair(value: string) {
  const stripped = clean(value).replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const range = splitRange(stripped);
  if (range.length !== 2) return null;
  const endMeridiem = range[1].match(/([ap])\.?m\.?$/i);
  const shared = endMeridiem
    ? ((endMeridiem[1].toLowerCase() === "p" ? "pm" : "am") as "am" | "pm")
    : undefined;
  const opens = to24h(range[0], shared);
  const closes = to24h(range[1]);
  if (!opens || !closes) return null;
  return { opens, closes };
}

function schemaDay(token: string) {
  return DAY_TO_SCHEMA[fold(token)] ?? DAY_TO_SCHEMA[token.toLowerCase()] ?? null;
}

function daysFromToken(token: string): string[] {
  const parts = splitRange(token);
  if (parts.length === 1) {
    const day = schemaDay(parts[0]);
    return day ? [day] : [];
  }
  if (parts.length !== 2) return [];
  const start = schemaDay(parts[0]);
  const end = schemaDay(parts[1]);
  if (!start || !end) return [];
  const startIndex = WEEK.indexOf(start as (typeof WEEK)[number]);
  const endIndex = WEEK.indexOf(end as (typeof WEEK)[number]);
  if (startIndex === -1 || endIndex === -1) return [];
  const days: string[] = [];
  let index = startIndex;
  while (true) {
    days.push(WEEK[index]);
    if (index === endIndex) break;
    index = (index + 1) % WEEK.length;
    if (days.length > 7) break;
  }
  return days;
}

function displayDayToken(token: string) {
  const parts = splitRange(token);
  const named = parts.map((part) => schemaDay(part) ?? part);
  if (named.length === 1) return named[0];
  if (named.length === 2) return `${named[0]}–${named[1]}`;
  return token;
}

export type OpeningHoursSpec = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek?: string | string[];
  opens?: string;
  closes?: string;
};

function pushSpecs(specs: OpeningHoursSpec[], days: string[], pair: { opens: string; closes: string }) {
  if (days.length === 0) {
    specs.push({
      "@type": "OpeningHoursSpecification",
      opens: pair.opens,
      closes: pair.closes,
    });
    return;
  }
  for (const day of days) {
    specs.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: day,
      opens: pair.opens,
      closes: pair.closes,
    });
  }
}

export function openingHoursFromRows(rows: string[]): OpeningHoursSpec[] {
  const specs: OpeningHoursSpec[] = [];
  const dayPrefix = new RegExp(`^(${DAY_TOKEN})(?:\\s*[–—-]\\s*(${DAY_TOKEN}))?\\s*[: ]\\s*(.+)$`, "i");

  for (const row of rows) {
    const text = clean(row);
    if (CLOSED.test(text) && !parseClockPair(text)) continue;

    const labeled = text.match(dayPrefix);
    if (labeled) {
      const token = labeled[2] ? `${labeled[1]}–${labeled[2]}` : labeled[1];
      const rest = labeled[3];
      if (CLOSED.test(rest) && !parseClockPair(rest)) continue;
      const pair = parseClockPair(rest);
      if (!pair) continue;
      pushSpecs(specs, daysFromToken(token), pair);
      continue;
    }

    const pair = parseClockPair(text);
    if (pair) pushSpecs(specs, [], pair);
  }
  return specs;
}

export function formatHoursRow(row: string) {
  const text = clean(row).replace(/\bcerrado\b/gi, "Closed");
  const dayPrefix = new RegExp(`^(${DAY_TOKEN})(?:\\s*[–—-]\\s*(${DAY_TOKEN}))?(\\s*[: ]\\s*)(.+)$`, "i");
  const labeled = text.match(dayPrefix);
  if (!labeled) return text;
  const token = labeled[2] ? `${labeled[1]}–${labeled[2]}` : labeled[1];
  return `${displayDayToken(token)}${labeled[3]}${labeled[4]}`;
}

export function hoursSummary(rows: string[]) {
  return rows.map(formatHoursRow).filter(Boolean).join("; ");
}
