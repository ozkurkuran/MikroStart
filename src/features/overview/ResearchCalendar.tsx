import { useMemo, useRef, useState } from "preact/hooks";

import { localeTag, useI18n } from "../../platform/i18n";
import {
  exportIcs,
  localDateKey,
  monthGrid,
  parseIcs,
  type CalendarEvent,
  type CalendarEventKind,
} from "./calendar";

interface ResearchCalendarProps {
  events: CalendarEvent[];
  onEventsChange: (events: CalendarEvent[]) => void;
}

const KINDS: readonly CalendarEventKind[] = ["experiment", "meeting", "deadline", "personal"];

function downloadFile(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ResearchCalendar({ events, onEventsChange }: ResearchCalendarProps) {
  const { locale, t } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(today));
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CalendarEventKind>("experiment");
  const [time, setTime] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const selectedEvents = events.filter((event) => event.date === selectedDate).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const upcoming = [...events].filter((event) => event.date >= localDateKey(today)).sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`)).slice(0, 3);
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag(locale), { weekday: "narrow" }).format(new Date(2026, 7, 24 + index)));

  function addEvent() {
    const clean = title.trim();
    if (!clean) return;
    onEventsChange([...events, { id: crypto.randomUUID(), title: clean.slice(0, 160), date: selectedDate, kind, ...(time ? { time } : {}) }]);
    setTitle("");
    setTime("");
  }

  function moveEvent(id: string, date: string) {
    onEventsChange(events.map((event) => event.id === id ? { ...event, date } : event));
    setSelectedDate(date);
  }

  async function importCalendar(file?: File) {
    if (!file) return;
    const imported = parseIcs((await file.text()).slice(0, 2_000_000));
    const ids = new Set(events.map((event) => event.id));
    onEventsChange([...events, ...imported.map((event) => ids.has(event.id) ? { ...event, id: crypto.randomUUID() } : event)].slice(0, 500));
  }

  return (
    <section class="overview-card calendar-card" aria-labelledby="calendar-title">
      <header class="overview-card__header calendar-card__header">
        <div>
          <p class="overview-card__eyebrow">{t("overview.calendar.eyebrow")}</p>
          <h2 id="calendar-title">{new Intl.DateTimeFormat(localeTag(locale), { month: "long", year: "numeric" }).format(anchor)}</h2>
        </div>
        <div class="calendar-actions">
          <button class="button button--small" type="button" onClick={() => { const now = new Date(); setAnchor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(localDateKey(now)); }}>{t("overview.calendar.today")}</button>
          <button class="icon-button" type="button" aria-label={t("overview.calendar.previous")} onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</button>
          <button class="icon-button" type="button" aria-label={t("overview.calendar.next")} onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</button>
        </div>
      </header>
      <div class="calendar-layout">
        <div class="calendar-month">
          <div class="calendar-weekdays" aria-hidden="true">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div class="calendar-grid">
            {days.map((day) => {
              const key = localDateKey(day);
              const dayEvents = events.filter((event) => event.date === key);
              const isToday = key === localDateKey(today);
              return (
                <button
                  key={key}
                  type="button"
                  class={`calendar-day${day.getMonth() !== anchor.getMonth() ? " calendar-day--muted" : ""}${selectedDate === key ? " calendar-day--selected" : ""}${isToday ? " calendar-day--today" : ""}`}
                  onClick={() => setSelectedDate(key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); moveEvent(event.dataTransfer?.getData("text/benchtab-event") ?? "", key); }}
                  aria-label={`${key}, ${dayEvents.length} ${t("overview.calendar.events")}`}
                >
                  <span>{day.getDate()}</span>
                  <span class="calendar-dots" aria-hidden="true">{dayEvents.slice(0, 4).map((event) => <i class={`calendar-dot calendar-dot--${event.kind}`} key={event.id} />)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <aside class="calendar-agenda">
          <h3>{new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", weekday: "short" }).format(new Date(`${selectedDate}T12:00:00`))}</h3>
          <div class="calendar-event-form">
            <input type="text" value={title} onInput={(event) => setTitle(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") addEvent(); }} placeholder={t("overview.calendar.eventPlaceholder")} aria-label={t("overview.calendar.eventTitle")} />
            <div>
              <select value={kind} onChange={(event) => setKind(event.currentTarget.value as CalendarEventKind)} aria-label={t("overview.calendar.eventKind")}>{KINDS.map((item) => <option value={item} key={item}>{t(`overview.calendar.kind.${item}`)}</option>)}</select>
              <input type="time" value={time} onInput={(event) => setTime(event.currentTarget.value)} aria-label={t("overview.calendar.eventTime")} />
              <button class="button button--primary button--small" type="button" onClick={addEvent}>+</button>
            </div>
          </div>
          <ul class="calendar-event-list">
            {selectedEvents.map((event) => (
              <li key={event.id} draggable onDragStart={(drag) => drag.dataTransfer?.setData("text/benchtab-event", event.id)}>
                <i class={`calendar-dot calendar-dot--${event.kind}`} aria-hidden="true" />
                <span><b>{event.title}</b><small>{event.time || t(`overview.calendar.kind.${event.kind}`)}</small></span>
                <button class="icon-button" type="button" aria-label={t("overview.calendar.remove")} onClick={() => onEventsChange(events.filter((item) => item.id !== event.id))}>×</button>
              </li>
            ))}
            {selectedEvents.length === 0 && <li class="calendar-event-list__empty">{t("overview.calendar.emptyDay")}</li>}
          </ul>
        </aside>
      </div>
      <footer class="calendar-footer">
        <div class="calendar-upcoming"><b>{t("overview.calendar.upcoming")}</b>{upcoming.length ? upcoming.map((event) => <span key={event.id}><i class={`calendar-dot calendar-dot--${event.kind}`} />{event.date.slice(5)} · {event.title}</span>) : <span>{t("overview.calendar.noUpcoming")}</span>}</div>
        <div>
          <input ref={importInput} class="sr-only" type="file" accept=".ics,text/calendar" onChange={(event) => { void importCalendar(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
          <button class="text-button" type="button" onClick={() => importInput.current?.click()}>{t("overview.calendar.import")}</button>
          <button class="text-button" type="button" onClick={() => downloadFile("benchtab-calendar.ics", exportIcs(events), "text/calendar;charset=utf-8")}>{t("overview.calendar.export")}</button>
        </div>
      </footer>
    </section>
  );
}
