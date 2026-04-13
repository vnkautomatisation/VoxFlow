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

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#7b61ff',
  CONFIRMED: '#00d4aa',
  CANCELLED: '#ff4d6d',
  COMPLETED: '#55557a',
  NO_SHOW:   '#ffb547',
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
    const bg = STATUS_COLORS[event.resource?.status] || '#7b61ff'
    return {
      style: {
        backgroundColor: bg,
        borderLeft: `3px solid ${bg}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        padding: '4px 8px',
        color: '#fff',
        boxShadow: `0 2px 8px ${bg}44`,
        lineHeight: '1.4',
        cursor: 'pointer',
      },
    }
  }, [])

  return (
    <div className="vf-cal-wrap" style={{ height: '100%', minHeight: 560 }}>
      <style>{`
        .vf-cal-wrap .rbc-calendar,
        .vf-cal-wrap .rbc-calendar * { box-sizing: border-box; }
        .vf-cal-wrap .rbc-calendar { background: transparent !important; color: #eeeef8 !important; font-family: 'DM Sans',sans-serif !important; border: none !important; }

        /* Toolbar */
        .vf-cal-wrap .rbc-toolbar { padding: 0 0 14px !important; margin-bottom: 0 !important; gap: 8px !important; }
        .vf-cal-wrap .rbc-toolbar button { color: #9898b8 !important; border: 1px solid #2e2e44 !important; background: #18181f !important; border-radius: 8px !important; padding: 7px 16px !important; font-size: 12px !important; font-weight: 600 !important; font-family: 'DM Sans',sans-serif !important; transition: all .15s !important; }
        .vf-cal-wrap .rbc-toolbar button:hover { background: #1f1f2a !important; color: #eeeef8 !important; }
        .vf-cal-wrap .rbc-toolbar button.rbc-active { background: #7b61ff !important; color: #fff !important; border-color: #7b61ff !important; box-shadow: 0 2px 8px rgba(123,97,255,.35) !important; }
        .vf-cal-wrap .rbc-toolbar-label { color: #eeeef8 !important; font-size: 15px !important; font-weight: 700 !important; }

        /* Header jours */
        .vf-cal-wrap .rbc-header { background: #15151f !important; border-color: #2e2e44 !important; color: #9898b8 !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.06em !important; padding: 10px 8px !important; }
        .vf-cal-wrap .rbc-header + .rbc-header { border-left-color: #2e2e44 !important; }

        /* Time view */
        .vf-cal-wrap .rbc-time-view { border: 1px solid #2e2e44 !important; border-radius: 14px !important; overflow: hidden !important; background: #0d0d16 !important; }
        .vf-cal-wrap .rbc-time-header { border-bottom: 1px solid #2e2e44 !important; }
        .vf-cal-wrap .rbc-time-header-content { border-left: 1px solid #2e2e44 !important; }
        .vf-cal-wrap .rbc-time-content { border-top: none !important; }
        .vf-cal-wrap .rbc-time-content > * + * > * { border-left: 1px solid #1a1a28 !important; }
        .vf-cal-wrap .rbc-timeslot-group { border-bottom: 1px solid #1a1a28 !important; min-height: 52px !important; }
        .vf-cal-wrap .rbc-time-slot { border-top: none !important; }
        .vf-cal-wrap .rbc-time-gutter .rbc-timeslot-group { border-bottom-color: #1a1a28 !important; }

        /* Heures label */
        .vf-cal-wrap .rbc-label { color: #4a4a6a !important; font-size: 10px !important; font-weight: 700 !important; padding: 0 10px !important; }

        /* Cellules */
        .vf-cal-wrap .rbc-day-bg { background: #0d0d16 !important; }
        .vf-cal-wrap .rbc-day-bg:hover { background: #121220 !important; }
        .vf-cal-wrap .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1a1a28 !important; }
        .vf-cal-wrap .rbc-today { background: rgba(123,97,255,0.06) !important; }
        .vf-cal-wrap .rbc-off-range-bg { background: #080810 !important; }

        /* Vue mois */
        .vf-cal-wrap .rbc-month-view { border: 1px solid #2e2e44 !important; border-radius: 14px !important; overflow: hidden !important; background: #0d0d16 !important; }
        .vf-cal-wrap .rbc-month-row + .rbc-month-row { border-top: 1px solid #1a1a28 !important; }
        .vf-cal-wrap .rbc-month-row { overflow: visible !important; }
        .vf-cal-wrap .rbc-date-cell { color: #55557a !important; font-size: 12px !important; font-weight: 600 !important; padding: 6px 10px !important; }
        .vf-cal-wrap .rbc-date-cell.rbc-now { color: #7b61ff !important; font-weight: 800 !important; }
        .vf-cal-wrap .rbc-row-bg { background: #0d0d16 !important; }

        /* Events */
        .vf-cal-wrap .rbc-event { outline: none !important; border: none !important; }
        .vf-cal-wrap .rbc-event:hover { filter: brightness(1.15) !important; transform: translateY(-1px) !important; }
        .vf-cal-wrap .rbc-event-label { font-size: 9px !important; opacity: .8 !important; }
        .vf-cal-wrap .rbc-event-content { font-size: 11px !important; font-weight: 600 !important; }
        .vf-cal-wrap .rbc-selected { box-shadow: 0 0 0 2px #eeeef8 !important; }
        .vf-cal-wrap .rbc-event-overlaps { box-shadow: -1px 1px 5px rgba(0,0,0,.2) !important; }

        /* Current time */
        .vf-cal-wrap .rbc-current-time-indicator { background: #7b61ff !important; height: 2px !important; box-shadow: 0 0 10px rgba(123,97,255,.7) !important; z-index: 3 !important; }

        /* Show more */
        .vf-cal-wrap .rbc-show-more { color: #7b61ff !important; font-size: 10px !important; font-weight: 700 !important; background: transparent !important; }

        /* Agenda */
        .vf-cal-wrap .rbc-agenda-view table { border-collapse: collapse !important; }
        .vf-cal-wrap .rbc-agenda-view table.rbc-agenda-table { border: 1px solid #2e2e44 !important; border-radius: 14px !important; overflow: hidden !important; }
        .vf-cal-wrap .rbc-agenda-view table thead th { background: #15151f !important; color: #55557a !important; border: none !important; border-bottom: 1px solid #2e2e44 !important; font-size: 10px !important; font-weight: 700 !important; text-transform: uppercase !important; padding: 10px 14px !important; }
        .vf-cal-wrap .rbc-agenda-view table tbody td { padding: 10px 14px !important; border-top: 1px solid #1a1a28 !important; color: #eeeef8 !important; font-size: 12px !important; }
        .vf-cal-wrap .rbc-agenda-view table tbody td + td { border-left: 1px solid #1a1a28 !important; }
        .vf-cal-wrap .rbc-agenda-date-cell { color: #9898b8 !important; }
        .vf-cal-wrap .rbc-agenda-time-cell { color: #55557a !important; }
        .vf-cal-wrap .rbc-agenda-empty { color: #55557a !important; text-align: center !important; padding: 40px !important; }

        /* Slot selection */
        .vf-cal-wrap .rbc-slot-selection { background: rgba(123,97,255,.12) !important; border: 1px dashed rgba(123,97,255,.4) !important; border-radius: 6px !important; }

        /* Scrollbar */
        .vf-cal-wrap .rbc-time-content::-webkit-scrollbar { width: 6px !important; }
        .vf-cal-wrap .rbc-time-content::-webkit-scrollbar-track { background: #0d0d16 !important; }
        .vf-cal-wrap .rbc-time-content::-webkit-scrollbar-thumb { background: #2e2e44 !important; border-radius: 3px !important; }

        /* All borders override */
        .vf-cal-wrap .rbc-month-header, .vf-cal-wrap .rbc-time-header-gutter { border-color: #2e2e44 !important; background: #15151f !important; }
        .vf-cal-wrap .rbc-allday-cell { border-color: #2e2e44 !important; background: #0d0d16 !important; }
        .vf-cal-wrap .rbc-row-content { z-index: 1 !important; }
      `}</style>
      <BigCalendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onView={v => setView(v)}
        onNavigate={d => setDate(d)}
        onSelectSlot={({ start, end }) => onCreate?.(start, end)}
        onSelectEvent={(event: any) => onSelect?.(event.resource)}
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
