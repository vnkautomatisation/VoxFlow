'use client'
import { useState, useCallback, useMemo } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { 'fr': fr }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales })

interface Appointment {
  id: string; title: string; starts_at: string; ends_at: string
  status: string; location?: string; contact_id?: string; agent_id?: string
}

interface Props {
  appointments: Appointment[]
  onSelect?: (apt: Appointment) => void
  onCreate?: (start: Date, end: Date) => void
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#7b61ff', CONFIRMED: '#00d4aa', CANCELLED: '#ff4d6d', COMPLETED: '#55557a', NO_SHOW: '#ffb547',
}

export default function CRMCalendar({ appointments, onSelect, onCreate }: Props) {
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(Views.WEEK)
  const [date, setDate] = useState(new Date())

  const events = useMemo(() => appointments.map(a => ({
    id:       a.id,
    title:    a.title,
    start:    new Date(a.starts_at),
    end:      new Date(a.ends_at),
    resource: a,
  })), [appointments])

  const eventStyleGetter = useCallback((event: any) => ({
    style: {
      backgroundColor: STATUS_COLORS[event.resource?.status] || '#7b61ff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 6px',
    },
  }), [])

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    onCreate?.(start, end)
  }, [onCreate])

  const handleSelectEvent = useCallback((event: any) => {
    onSelect?.(event.resource)
  }, [onSelect])

  return (
    <div style={{ height: '100%', minHeight: 500 }}>
      <style>{`
        .rbc-calendar { background: #111118; color: #eeeef8; font-family: 'DM Sans', sans-serif; border: none; }
        .rbc-toolbar { padding: 8px 0; margin-bottom: 8px; }
        .rbc-toolbar button { color: #9898b8; border: 1px solid #2e2e44; background: #18181f; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 600; }
        .rbc-toolbar button:hover { background: #1f1f2a; color: #eeeef8; }
        .rbc-toolbar button.rbc-active { background: #7b61ff; color: white; border-color: #7b61ff; }
        .rbc-header { background: #18181f; border-bottom: 1px solid #2e2e44; color: #55557a; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px; }
        .rbc-header + .rbc-header { border-left: 1px solid #2e2e44; }
        .rbc-time-view, .rbc-month-view { border: 1px solid #2e2e44; border-radius: 12px; overflow: hidden; }
        .rbc-time-header { border-bottom: 1px solid #2e2e44; }
        .rbc-time-content { border-top: none; }
        .rbc-timeslot-group { border-bottom: 1px solid #1a1a2e; }
        .rbc-time-slot { border-top: none; }
        .rbc-day-bg { background: #111118; }
        .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1a1a2e; }
        .rbc-today { background: #7b61ff08 !important; }
        .rbc-off-range-bg { background: #0a0a14; }
        .rbc-month-row + .rbc-month-row { border-top: 1px solid #1a1a2e; }
        .rbc-date-cell { color: #55557a; font-size: 12px; padding: 4px 8px; }
        .rbc-date-cell.rbc-now { color: #7b61ff; font-weight: 700; }
        .rbc-label { color: #35355a; font-size: 10px; }
        .rbc-current-time-indicator { background: #7b61ff; height: 2px; }
        .rbc-event { box-shadow: 0 2px 8px rgba(0,0,0,.3); }
        .rbc-event:hover { filter: brightness(1.15); }
        .rbc-selected { outline: 2px solid #7b61ff !important; }
        .rbc-show-more { color: #7b61ff; font-size: 10px; font-weight: 700; }
        .rbc-toolbar-label { color: #eeeef8; font-size: 14px; font-weight: 700; }
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
      />
    </div>
  )
}
