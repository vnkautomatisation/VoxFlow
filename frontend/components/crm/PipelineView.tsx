"use client"

const STAGES = [
  { id: "NEW",         label: "Nouveau",      color: "border-gray-600" },
  { id: "QUALIFIED",   label: "Qualifie",     color: "border-blue-600" },
  { id: "PROPOSAL",    label: "Proposition",  color: "border-purple-600" },
  { id: "NEGOTIATION", label: "Negociation",  color: "border-amber-600" },
  { id: "WON",         label: "Gagne",        color: "border-green-600" },
  { id: "LOST",        label: "Perdu",        color: "border-red-600" },
]

interface Props {
  pipeline:          any
  contacts:          any[]
  onSelectContact:   (c: any) => void
}

export default function PipelineView({ pipeline, contacts, onSelectContact }: Props) {
  return (
    <div>
      <h2 className="text-white font-semibold text-lg mb-4">Vue Pipeline</h2>
      <div className="grid grid-cols-6 gap-3">
        {STAGES.map((stage) => {
          const stageContacts = contacts.filter((c) => c.pipeline_stage === stage.id)
          const stageData     = pipeline?.pipeline?.[stage.id]

          return (
            <div key={stage.id} className={"bg-gray-900 border-t-2 rounded-xl p-3 " + stage.color}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-xs font-medium">{stage.label}</p>
                <span className="text-gray-500 text-xs">{stageData?.count || 0}</span>
              </div>
              {stageData?.totalValue > 0 && (
                <p className="text-green-400 text-xs mb-2 font-mono">{stageData.totalValue.toFixed(0)} $</p>
              )}
              <div className="space-y-2">
                {stageContacts.slice(0, 5).map((c) => (
                  <div key={c.id} onClick={() => onSelectContact(c)}
                    className="bg-gray-800 rounded-lg p-2 cursor-pointer hover:bg-gray-700 transition-colors"
                  >
                    <p className="text-white text-xs font-medium truncate">{c.first_name} {c.last_name}</p>
                    {c.company && <p className="text-gray-500 text-xs truncate">{c.company}</p>}
                    {c.deal_value > 0 && <p className="text-green-400 text-xs">{parseFloat(c.deal_value).toFixed(0)} $</p>}
                  </div>
                ))}
                {stageContacts.length > 5 && (
                  <p className="text-gray-600 text-xs text-center">+{stageContacts.length - 5} autres</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
