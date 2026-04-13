'use client'
import { useState, useCallback, useMemo } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { 'fr': fr }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }), getDay, locales })

interface Appointment {
  id: string; title: string; starts_at: string; ends_at: string
  status: string; location?: string; contact_id?: string; agent_id?: string
  type?: string; notes?: string
}

interface Props {
  appointments: Appointment[]
  contacts?: { id: string; first_name: string; last_name: string }[]
  onSelect?: (apt: Appointment) => void
  onCreate?: (start: Date, end: Date) => void
}

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  SCHEDULED: { bg: '#7b61ff', border: '#6145ff' },
  CONFIRMED: { bg: '#00d4aa', border: '#00b890' },
  CANCELLED: { bg: '#ff4d6d', border: '#e03050' },
  COMPLETED: { bg: '#55557a', border: '#3a3a55' },
  NO_SHOW:   { bg: '#ffb547', border: '#e09a30' },
}

const TYPE_ICONS: Record<string, string> = {
  CALL: 'tel',
  VIDEO: 'cam',
  MEETING: 'mtg',
  VISIT: 'vis',
}

export default function CRMCalendar({ appointments, contacts, onSelect, onCreate }: Props) {
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(Views.WEEK)
  const [date, setDate] = useState(new Date())

  const events = useMemo(() => appointments.map(a => {
    const ct = contacts?.find(c => c.id === a.contact_id)
    return {
      id:       a.id,
      title:    ct ? `${a.title} — ${ct.first_name} ${ct.last_name}` : a.title,
      start:    new Date(a.starts_at),
      end:      new Date(a.ends_at),
      resource: a,
    }
  }), [appointments, contacts])

  const eventStyleGetter = useCallback((event: any) => {
    const colors = STATUS_COLORS[event.resource?.status] || STATUS_COLORS.SCHEDULED
    return {
      style: {
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        padding: '3px 8px',
        color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,.3)',
        boxShadow: '0 2px 8px rgba(0,0,0,.25)',
        lineHeight: '1.3',
      },
    }
  }, [])

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    onCreate?.(start, end)
  }, [onCreate])

  const handleSelectEvent = useCallback((event: any) => {
    onSelect?.(event.resource)
  }, [onSelect])

  return (
    <div style={{ height: '100%', minHeight: 560 }}>
      <style>{`
        /* ── Base ── */
        .rbc-calendar {
          background: transparent;
          color: #eeeef8;
          font-family: 'DM Sans', sans-serif;
          border: none;
        }

        /* ── Toolbar ── */
        .rbc-toolbar {
          padding: 0 0 12px;
          margin-bottom: 0;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rbc-toolbar button {
          color: #9898b8;
          border: 1px solid #2e2e44;
          background: #18181f;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .rbc-toolbar button:hover {
          background: #1f1f2a;
          color: #eeeef8;
          border-color: #3a3a55;
        }
        .rbc-toolbar button.rbc-active {
          background: #7b61ff;
          color: white;
          border-color: #7b61ff;
          box-shadow: 0 2px 8px rgba(123,97,255,.3);
        }
        .rbc-toolbar-label {
          color: #eeeef8;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .rbc-btn-group {
          gap: 2px;
        }

        /* ── Header (jours) ── */
        .rbc-header {
          background: #18181f;
          border-bottom: 1px solid #2e2e44 !important;
          color: #9898b8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 10px 8px;
        }
        .rbc-header + .rbc-header {
          border-left: 1px solid #2e2e44 !important;
        }

        /* ── Vue semaine/jour ── */
        .rbc-time-view {
          border: 1px solid #2e2e44;
          border-radius: 12px;
          overflow: hidden;
          background: #111118;
        }
        .rbc-time-header {
          border-bottom: 1px solid #2e2e44;
        }
        .rbc-time-header-content {
          border-left: 1px solid #2e2e44;
        }
        .rbc-time-content {
          border-top: none;
        }
        .rbc-time-content > * + * > * {
          border-left: 1px solid #1a1a2e;
        }
        .rbc-timeslot-group {
          border-bottom: 1px solid #1a1a2e;
          min-height: 48px;
        }
        .rbc-time-slot {
          border-top: none;
        }
        .rbc-time-gutter .rbc-timeslot-group {
          border-bottom: 1px solid #1a1a2e;
        }

        /* ── Label heures ── */
        .rbc-label {
          color: #55557a;
          font-size: 10px;
          font-weight: 600;
          padding: 0 8px;
        }

        /* ── Cellules jour ── */
        .rbc-day-bg {
          background: #111118;
          transition: background 0.15s;
        }
        .rbc-day-bg:hover {
          background: #15151f;
        }
        .rbc-day-bg + .rbc-day-bg {
          border-left: 1px solid #1a1a2e;
        }
        .rbc-today {
          background: rgba(123,97,255,0.04) !important;
        }
        .rbc-off-range-bg {
          background: #0a0a14;
        }

        /* ── Vue mois ── */
        .rbc-month-view {
          border: 1px solid #2e2e44;
          border-radius: 12px;
          overflow: hidden;
          background: #111118;
        }
        .rbc-month-row + .rbc-month-row {
          border-top: 1px solid #1a1a2e;
        }
        .rbc-date-cell {
          color: #55557a;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 8px;
        }
        .rbc-date-cell.rbc-now {
          color: #7b61ff;
          font-weight: 800;
        }

        /* ── Evenements ── */
        .rbc-event {
          box-shadow: 0 2px 8px rgba(0,0,0,.3);
          outline: none !important;
        }
        .rbc-event:hover {
          filter: brightness(1.12);
          transform: scale(1.01);
          z-index: 10 !important;
        }
        .rbc-event:focus {
          outline: 2px solid #7b61ff !important;
          outline-offset: 1px;
        }
        .rbc-event-label {
          font-size: 10px;
          font-weight: 600;
          opacity: 0.85;
        }
        .rbc-event-content {
          font-size: 11px;
          font-weight: 600;
        }
        .rbc-selected {
          outline: 2px solid #eeeef8 !important;
          outline-offset: 1px;
        }

        /* ── Indicateur heure courante ── */
        .rbc-current-time-indicator {
          background: #7b61ff;
          height: 2px;
          box-shadow: 0 0 8px rgba(123,97,255,.6);
        }

        /* ── Show more ── */
        .rbc-show-more {
          color: #7b61ff;
          font-size: 10px;
          font-weight: 700;
          background: transparent !important;
        }

        /* ── Agenda ── */
        .rbc-agenda-view table.rbc-agenda-table {
          border: 1px solid #2e2e44;
          border-radius: 12px;
          overflow: hidden;
        }
        .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
          background: #18181f;
          color: #55557a;
          border-bottom: 1px solid #2e2e44;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 10px 12px;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          padding: 8px 12px;
          border-top: 1px solid #1a1a2e;
          color: #eeeef8;
          font-size: 12px;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td + td {
          border-left: 1px solid #1a1a2e;
        }
        .rbc-agenda-date-cell, .rbc-agenda-time-cell {
          color: #9898b8;
          white-space: nowrap;
        }
        .rbc-agenda-event-cell {
          color: #eeeef8;
        }

        /* ── Selection slot ── */
        .rbc-slot-selection {
          background: rgba(123,97,255,0.15);
          border: 1px solid rgba(123,97,255,0.4);
          border-radius: 4px;
        }

        /* ── Scrollbar ── */
        .rbc-time-content::-webkit-scrollbar {
          width: 6px;
        }
        .rbc-time-content::-webkit-scrollbar-track {
          background: #111118;
        }
        .rbc-time-content::-webkit-scrollbar-thumb {
          background: #2e2e44;
          border-radius: 3px;
        }
      `}</style>
      <BigCalendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onView={v => setView(v)}
        onNavigate={d => setDate(d)}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        selectable
        eventPropGetter={eventStyleGetter}
        messages={{
          today: "Aujourd'hui", previous: 'Prec.', next: 'Suiv.',
          month: 'Mois', week: 'Semaine', day: 'Jour', agenda: 'Agenda',
          noEventsInRange: 'Aucun rendez-vous sur cette periode.',
        }}
        culture="fr"
        step={30}
        timeslots={2}
        scrollToTime={new Date(new Date().setHours(8, 0, 0, 0))}
        min={new Date(new Date().setHours(6, 0, 0, 0))}
        max={new Date(new Date().setHours(22, 0, 0, 0))}
      />
    </div>
  )
}
