"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { crmApi } from "@/lib/crmApi"
import ContactsList from "@/components/crm/ContactsList"
import ContactForm from "@/components/crm/ContactForm"
import ContactDetail from "@/components/crm/ContactDetail"
import PipelineView from "@/components/crm/PipelineView"
import ImportModal from "@/components/crm/ImportModal"

type View = "list" | "pipeline" | "detail" | "new"

export default function CRMPage() {
  const router = useRouter()
  const [token,    setToken]    = useState<string | null>(null)
  const [mounted,  setMounted]  = useState(false)
  const [view,     setView]     = useState<View>("list")
  const [contacts, setContacts] = useState<any[]>([])
  const [total,    setTotal]    = useState(0)
  const [pipeline, setPipeline] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [tags,     setTags]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [search,   setSearch]   = useState("")
  const [filters,  setFilters]  = useState<any>({})
  const [page,     setPage]     = useState(1)

  useEffect(() => {
    setMounted(true)
    try {
      const raw    = localStorage.getItem("voxflow-auth")
      if (!raw) { window.location.href = "/login"; return }
      const parsed = JSON.parse(raw)
      const state  = parsed.state || parsed
      if (!state.accessToken) { window.location.href = "/login"; return }
      setToken(state.accessToken)
    } catch { window.location.href = "/login" }
  }, [])

  useEffect(() => { if (token) loadData() }, [token, search, filters, page])

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params: any = { page, limit: 20, ...filters }
      if (search) params.search = search

      const [contactsRes, pipelineRes, tagsRes] = await Promise.all([
        crmApi.getContacts(token, params),
        crmApi.getPipeline(token),
        crmApi.getTags(token),
      ])
      if (contactsRes.success) { setContacts(contactsRes.data.contacts || []); setTotal(contactsRes.data.total || 0) }
      if (pipelineRes.success) setPipeline(pipelineRes.data)
      if (tagsRes.success)     setTags(tagsRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [token, search, filters, page])

  const handleSelectContact = async (contact: any) => {
    if (!token) return
    const res = await crmApi.getContact(token, contact.id)
    if (res.success) { setSelected(res.data); setView("detail") }
  }

  const handleDeleteContact = async (id: string) => {
    if (!token || !confirm("Supprimer ce contact ?")) return
    await crmApi.deleteContact(token, id)
    loadData()
  }

  if (!mounted || !token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  const STATUS_OPTIONS = ["LEAD", "PROSPECT", "CLIENT", "INACTIVE"]
  const STAGE_OPTIONS  = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">
              Dashboard
            </button>
            <h1 className="text-xl font-bold text-white">
              Vox<span className="text-teal-500">Flow</span>
              <span className="text-gray-500 text-sm font-normal ml-2">CRM</span>
            </h1>
            <div className="flex gap-1">
              {[
                { id: "list",     label: "Contacts (" + total + ")" },
                { id: "pipeline", label: "Pipeline" },
              ].map((v) => (
                <button key={v.id} onClick={() => setView(v.id as View)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (view === v.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)}
              className="border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800"
            >
              Importer CSV
            </button>
            <button onClick={() => setView("new")}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
            >
              + Nouveau contact
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Pipeline stats rapides */}
        {pipeline && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total contacts", value: total.toString(),                         color: "text-white" },
              { label: "Pipeline total", value: pipeline.totalValue.toFixed(0) + " $",    color: "text-teal-400" },
              { label: "Revenus gagnes", value: pipeline.wonValue.toFixed(0) + " $",      color: "text-green-400" },
              { label: "Taux conversion", value: pipeline.conversionRate + "%",           color: "text-purple-400" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                <p className={"text-xl font-bold " + s.color}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Vue liste */}
        {(view === "list" || view === "detail" || view === "new") && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              {/* Filtres */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-3">
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Rechercher nom, email, tel..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 mb-3"
                />
                <div className="space-y-2">
                  <select value={filters.status || ""} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
                  >
                    <option value="">Tous les statuts</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={filters.stage || ""} onChange={(e) => setFilters({ ...filters, stage: e.target.value || undefined })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
                  >
                    <option value="">Toutes les etapes</option>
                    {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {tags.length > 0 && (
                    <select value={filters.tag || ""} onChange={(e) => setFilters({ ...filters, tag: e.target.value || undefined })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
                    >
                      <option value="">Tous les tags</option>
                      {tags.map((t: any) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <ContactsList
                contacts={contacts}
                loading={loading}
                selected={selected?.id}
                onSelect={handleSelectContact}
                onDelete={handleDeleteContact}
                page={page}
                total={total}
                onPage={setPage}
              />
            </div>

            <div className="col-span-2">
              {view === "new" && (
                <ContactForm
                  token={token}
                  tags={tags}
                  onSave={() => { loadData(); setView("list") }}
                  onCancel={() => setView("list")}
                />
              )}
              {view === "detail" && selected && (
                <ContactDetail
                  contact={selected}
                  token={token}
                  tags={tags}
                  onUpdate={(updated: any) => setSelected(updated)}
                  onRefresh={async () => {
                    const res = await crmApi.getContact(token, selected.id)
                    if (res.success) setSelected(res.data)
                  }}
                  onBack={() => { setView("list"); setSelected(null) }}
                />
              )}
              {view === "list" && !selected && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">Selectionnez un contact pour voir sa fiche</p>
                  <p className="text-gray-600 text-xs mt-1">ou cliquez sur "+ Nouveau contact"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vue pipeline */}
        {view === "pipeline" && pipeline && (
          <PipelineView pipeline={pipeline} contacts={contacts} onSelectContact={handleSelectContact} />
        )}
      </div>

      {showImport && (
        <ImportModal token={token} onClose={() => setShowImport(false)} onImported={() => { loadData(); setShowImport(false) }} />
      )}
    </div>
  )
}
