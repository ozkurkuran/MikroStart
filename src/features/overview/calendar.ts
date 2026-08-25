export type CalendarEventKind = "experiment" | "meeting" | "deadline" | "personal";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  kind: CalendarEventKind;
  time?: string;
  notes?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function unfoldIcs(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, "").replace(/\r/g, "").split("\n");
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function icsDate(value: string): { date: string; time?: string } | undefined {
  const compact = value.trim();
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return undefined;
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: match[4] && match[5] ? `${match[4]}:${match[5]}` : undefined,
  };
}

export function parseIcs(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let record: Record<string, string> | undefined;
  for (const line of unfoldIcs(text)) {
    if (line === "BEGIN:VEVENT") {
      record = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (record?.DTSTART && record.SUMMARY) {
        const parsedDate = icsDate(record.DTSTART);
        if (parsedDate) {
          events.push({
            id: record.UID?.slice(0, 160) || crypto.randomUUID(),
            title: unescapeIcs(record.SUMMARY).slice(0, 160),
            ...parsedDate,
            notes: record.DESCRIPTION ? unescapeIcs(record.DESCRIPTION).slice(0, 1000) : undefined,
            kind: ["experiment", "meeting", "deadline", "personal"].includes(record.CATEGORIES?.toLowerCase() ?? "")
              ? record.CATEGORIES.toLowerCase() as CalendarEventKind
              : "personal",
          });
        }
      }
      record = undefined;
      continue;
    }
    if (!record) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).split(";")[0];
    if (["UID", "SUMMARY", "DESCRIPTION", "DTSTART", "CATEGORIES"].includes(key)) {
      record[key] = line.slice(separator + 1);
    }
  }
  return events.slice(0, 500);
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function exportIcs(events: readonly CalendarEvent[]): string {
  const rows = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BenchTab//Research Calendar//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    const date = event.date.replace(/-/g, "");
    rows.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(event.id.includes("@") ? event.id : `${event.id}@benchtab.local`)}`,
      event.time ? `DTSTART:${date}T${event.time.replace(":", "")}00` : `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `CATEGORIES:${event.kind.toUpperCase()}`,
      ...(event.notes ? [`DESCRIPTION:${escapeIcs(event.notes)}`] : []),
      "END:VEVENT",
    );
  }
  rows.push("END:VCALENDAR");
  return `${rows.join("\r\n")}\r\n`;
}
