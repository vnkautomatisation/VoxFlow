"use client"

import { useState } from "react"
import { queuesApi } from "@/lib/queuesApi"

const DAYS = [
  { key: "monday",    label: "Lundi" },
  { key: "tuesday",   label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday",  label: "Jeudi" },
  { key: "friday",    label: "Vendredi" },
  { key: "saturday",  label: "Samedi" },
  { key: "sunday",    label: "Dimanche" },
]

const DEFAULT_HOURS = {
  monday:    { open: "09:00", close: "17:00", enabled: true },
  tuesday:   { open: "09:00", close: "17:00", enabled: true },
  wednesday: { open: "09:00", close: "17:00", enabled: true },
  thursday:  { open: "09:00", close: "17:00", enabled: true },
  friday:    { open: "09:00", close: "17:00", enabled: true },
  saturday:  { open: "10:00", close: "14:00", enabled: false },
  sunday:    { open: "10:00", close: "14:00", enabled: false },
}

interface Props {
  token:     string
  schedules: any[]
  onRefresh: () => void
}

export default function ScheduleEditor({ token, schedules, onRefresh }: Props) {
  const [selected, setSelected] = useState<any>(schedules[0] || null)
  const [hours,    setHours]    = useState<any>(schedules[0]?.hours || DEFAULT_HOURS)
  const [closedMsg, setClosedMsg] = useState(schedules[0]?.closed_message || "Nous sommes presentement fermes.")
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState("")

  const handleSelectSchedule = (s: any) => {
    setSelected(s)
    setHours(s.hours || DEFAULT_HOURS)
    setClosedMsg(s.closed_message || "")
  }

  const handleToggleDay = (day: string) => {
    setHours((h: any) => ({ ...h, [day]: { ...h[day], enabled: !h[day].enabled } }))
  }

  const handleTimeChange = (day: string, field: "open" | "close", value: string) => {
    setHours((h: any) => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  const handleSave = async () => {
    if (!token || !selected) return
    setSaving(true)
    try {
      await queuesApi.updateSchedule(token, selected.id, { hours, closed_message: closedMsg })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onRefresh()
    } catch {}
    finally { setSaving(false) }
  }

  const handleCreate = async () => {
    if (!token || !newName) return
    try {
      await queuesApi.createSchedule(token, { name: newName, hours: DEFAULT_HOURS, timezone: "America/Toronto" })
      setShowNew(false)
      setNewName("")
      onRefresh()
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Horaires d ouverture</h2>
        <button onClick={() => setShowNew(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
          + Nouvel horaire
        </button>
      </div>

      {showNew && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex gap-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de l horaire..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          <button onClick={handleCreate} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm">Creer</button>
          <button onClick={() => setShowNew(false)} className="border border-gray-700 text-gray-400 px-3 py-2 rounded-lg text-sm">Annuler</button>
        </div>
      )}

      {schedules.length > 1 && (
        <div className="flex gap-2 mb-4">
          {schedules.map((s) => (
            <button key={s.id} onClick={() => handleSelectSchedule(s)}
              className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (selected?.id === s.id ? "bg-gray-700 text-white" : "border border-gray-700 text-gray-400")}
            >{s.name}</button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="space-y-2 mb-5">
            {DAYS.map((day) => (
              <div key={day.key} className={"flex items-center gap-4 p-3 rounded-lg " + (hours[day.key]?.enabled ? "bg-gray-800" : "bg-gray-900")}>
                <div className="w-24 flex items-center gap-2">
                  <div
                    onClick={() => handleToggleDay(day.key)}
                    className={"w-9 h-5 rounded-full cursor-pointer transition-colors relative " + (hours[day.key]?.enabled ? "bg-teal-600" : "bg-gray-700")}
                  >
                    <div className={"w-3 h-3 bg-white rounded-full absolute top-1 transition-all " + (hours[day.key]?.enabled ? "right-1" : "left-1")}></div>
                  </div>
                  <span className={"text-sm " + (hours[day.key]?.enabled ? "text-white" : "text-gray-500")}>{day.label}</span>
                </div>
                {hours[day.key]?.enabled ? (
                  <div className="flex items-center gap-2">
                    <input type="time" value={hours[day.key]?.open || "09:00"}
                      onChange={(e) => handleTimeChange(day.key, "open", e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none" />
                    <span className="text-gray-400 text-sm">—</span>
                    <input type="time" value={hours[day.key]?.close || "17:00"}
                      onChange={(e) => handleTimeChange(day.key, "close", e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none" />
                  </div>
                ) : (
                  <span className="text-gray-600 text-sm">Ferm&eacute;</span>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-xs mb-1 block">Message hors-heures</label>
            <textarea value={closedMsg} onChange={(e) => setClosedMsg(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >{saving ? "Sauvegarde..." : "Sauvegarder"}</button>
            {saved && <span className="text-green-400 text-sm">Sauvegarde !</span>}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">Aucun horaire configure</p>
        </div>
      )}
    </div>
  )
}
