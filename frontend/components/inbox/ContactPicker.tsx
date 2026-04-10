"use client"

import { useState, useEffect, useRef } from "react"
import { crmApi } from "@/lib/crmApi"

export interface PickedContact {
  id?:          string
  first_name:   string
  last_name?:   string
  email?:       string
  phone?:       string
  company?:     string
  isNew?:       boolean
}

interface Props {
  token:        string
  value:        PickedContact | null
  onChange:     (c: PickedContact | null) => void
  requireEmail?: boolean
  requirePhone?: boolean
}

export default function ContactPicker({ token, value, onChange, requireEmail, requirePhone }: Props) {
  const [query,   setQuery]   = useState("")
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mode,    setMode]    = useState<"search" | "create">("search")
  const [showDropdown, setShowDropdown] = useState(false)
  const [newForm, setNewForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", company: "",
  })
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState("")
  const searchTimer = useRef<any>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (mode !== "search") return
    if (!query.trim()) { setResults([]); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await crmApi.searchContacts(token, query.trim())
        if (r.success) setResults(Array.isArray(r.data) ? r.data : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(searchTimer.current)
  }, [query, token, mode])

  // Close dropdown on click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const handleSelect = (c: any) => {
    onChange({
      id:         c.id,
      first_name: c.first_name || "",
      last_name:  c.last_name  || "",
      email:      c.email      || "",
      phone:      c.phone      || "",
      company:    c.company    || "",
      isNew:      false,
    })
    setQuery("")
    setResults([])
    setShowDropdown(false)
  }

  const handleClear = () => {
    onChange(null)
    setMode("search")
    setNewForm({ first_name: "", last_name: "", email: "", phone: "", company: "" })
    setErr("")
  }

  const handleCreate = async () => {
    if (!newForm.first_name.trim()) { setErr("Prénom requis"); return }
    if (requireEmail && !newForm.email.trim()) { setErr("Email requis"); return }
    if (requirePhone && !newForm.phone.trim()) { setErr("Téléphone requis"); return }

    setCreating(true)
    setErr("")
    try {
      const r = await crmApi.createContact(token, {
        first_name: newForm.first_name.trim(),
        last_name:  newForm.last_name.trim() || null,
        email:      newForm.email.trim()     || null,
        phone:      newForm.phone.trim()     || null,
        company:    newForm.company.trim()   || null,
      })
      if (!r.success) throw new Error(r.error || "Erreur création")
      onChange({
        id:         r.data.id,
        first_name: r.data.first_name,
        last_name:  r.data.last_name,
        email:      r.data.email,
        phone:      r.data.phone,
        company:    r.data.company,
        isNew:      true,
      })
      setMode("search")
      setNewForm({ first_name: "", last_name: "", email: "", phone: "", company: "" })
    } catch (e: any) {
      setErr(e.message || "Erreur création contact")
    } finally { setCreating(false) }
  }

  // Valeur sélectionnée — affichage compact
  if (value) {
    const fullName = `${value.first_name} ${value.last_name || ""}`.trim()
    return (
      <div className="bg-[#1f1f2a] border border-[#7b61ff]/30 rounded-lg px-3 py-2 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#7b61ff]/20 border border-[#7b61ff]/40 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#7b61ff]">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#eeeef8] truncate">{fullName}</div>
          <div className="text-[10px] text-[#55557a] truncate">
            {value.email || value.phone || "—"}
            {value.company ? " · " + value.company : ""}
            {value.isNew && <span className="ml-1 text-emerald-400">· Nouveau</span>}
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-[#55557a] hover:text-rose-400 transition-colors flex-shrink-0"
          title="Retirer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18" />
            <line x1="6"  y1="6"  x2="18" y2="18" />
          </svg>
        </button>
      </div>
    )
  }

  // Mode création
  if (mode === "create") {
    return (
      <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7b61ff]">Nouveau contact</span>
          <button onClick={() => { setMode("search"); setErr("") }} className="text-[10px] text-[#55557a] hover:text-[#9898b8]">Annuler</button>
        </div>

        {err && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded px-2 py-1 text-[10px]">{err}</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input
            value={newForm.first_name}
            onChange={(e) => setNewForm({ ...newForm, first_name: e.target.value })}
            placeholder="Prénom *"
            className="bg-[#18181f] border border-[#2e2e44] rounded px-2 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff]"
          />
          <input
            value={newForm.last_name}
            onChange={(e) => setNewForm({ ...newForm, last_name: e.target.value })}
            placeholder="Nom"
            className="bg-[#18181f] border border-[#2e2e44] rounded px-2 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff]"
          />
        </div>

        <input
          value={newForm.email}
          onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
          placeholder={`Email${requireEmail ? " *" : ""}`}
          type="email"
          className="w-full bg-[#18181f] border border-[#2e2e44] rounded px-2 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff]"
        />

        <input
          value={newForm.phone}
          onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
          placeholder={`Téléphone${requirePhone ? " *" : ""}`}
          className="w-full bg-[#18181f] border border-[#2e2e44] rounded px-2 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff]"
        />

        <input
          value={newForm.company}
          onChange={(e) => setNewForm({ ...newForm, company: e.target.value })}
          placeholder="Entreprise"
          className="w-full bg-[#18181f] border border-[#2e2e44] rounded px-2 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff]"
        />

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
        >
          {creating ? "Création..." : "Créer le contact"}
        </button>
      </div>
    )
  }

  // Mode recherche (par défaut)
  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
        onFocus={() => setShowDropdown(true)}
        placeholder="Rechercher un contact (nom, email, téléphone...)"
        className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 pl-9 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
      />
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      {showDropdown && (query.trim() || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181f] border border-[#2e2e44] rounded-lg shadow-2xl max-h-64 overflow-y-auto z-10">
          {loading && <div className="px-3 py-3 text-[#55557a] text-xs text-center">Recherche...</div>}

          {!loading && results.length === 0 && query.trim() && (
            <div className="px-3 py-3 text-[#55557a] text-xs text-center">Aucun contact trouvé</div>
          )}

          {!loading && results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-[#1f1f2a] transition-colors border-b border-[#2e2e44] last:border-0 flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-[#2d1a80] flex items-center justify-center text-[10px] font-bold text-[#a78bfa] flex-shrink-0">
                {((c.first_name?.[0] || "") + (c.last_name?.[0] || "")).toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[#eeeef8] truncate">
                  {`${c.first_name || ""} ${c.last_name || ""}`.trim() || "Sans nom"}
                </div>
                <div className="text-[10px] text-[#55557a] truncate">
                  {c.email || c.phone || "—"}
                  {c.company ? " · " + c.company : ""}
                </div>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => { setMode("create"); setShowDropdown(false); setNewForm({ ...newForm, first_name: query }) }}
            className="w-full text-left px-3 py-2 hover:bg-[#7b61ff]/10 transition-colors border-t border-[#2e2e44] flex items-center gap-2 text-[#7b61ff]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5"  y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-xs font-bold">Créer un nouveau contact</span>
          </button>
        </div>
      )}
    </div>
  )
}
