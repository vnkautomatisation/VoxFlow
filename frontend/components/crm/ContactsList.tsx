"use client"

const STATUS_COLORS: Record<string, string> = {
  CLIENT:   "bg-green-900 text-green-300",
  LEAD:     "bg-blue-900 text-blue-300",
  PROSPECT: "bg-purple-900 text-purple-300",
  INACTIVE: "bg-gray-800 text-gray-400",
}

const STAGE_LABELS: Record<string, string> = {
  NEW:         "Nouveau",
  QUALIFIED:   "Qualifie",
  PROPOSAL:    "Proposition",
  NEGOTIATION: "Negociation",
  WON:         "Gagne",
  LOST:        "Perdu",
}

interface Props {
  contacts: any[]
  loading:  boolean
  selected?: string
  onSelect: (c: any) => void
  onDelete: (id: string) => void
  page:     number
  total:    number
  onPage:   (p: number) => void
}

export default function ContactsList({ contacts, loading, selected, onSelect, onDelete, page, total, onPage }: Props) {
  const totalPages = Math.ceil(total / 20)

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm animate-pulse">Chargement...</p>
    </div>
  )

  if (contacts.length === 0) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm">Aucun contact</p>
    </div>
  )

  return (
    <div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {contacts.map((c) => (
          <div key={c.id}
            onClick={() => onSelect(c)}
            className={"px-4 py-3 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-gray-800/50 transition-colors " + (selected === c.id ? "bg-gray-800/70 border-l-2 border-l-teal-500" : "")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-900 rounded-full flex items-center justify-center text-teal-300 text-sm font-bold flex-shrink-0">
                {(c.first_name?.charAt(0) || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-gray-500 text-xs truncate">{c.company || c.email || c.phone}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={"text-xs px-1.5 py-0.5 rounded-full " + (STATUS_COLORS[c.status] || "bg-gray-800 text-gray-400")}>
                  {c.status}
                </span>
                <span className="text-gray-600 text-xs">{STAGE_LABELS[c.pipeline_stage] || c.pipeline_stage}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
            className="text-xs border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-800"
          >Precedent</button>
          <span className="text-gray-500 text-xs">{page} / {totalPages}</span>
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="text-xs border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-800"
          >Suivant</button>
        </div>
      )}
    </div>
  )
}
