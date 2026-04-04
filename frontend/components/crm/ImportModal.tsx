"use client"

import { useState } from "react"
import { crmApi } from "@/lib/crmApi"

interface Props {
  token:       string
  onClose:     () => void
  onImported:  () => void
}

export default function ImportModal({ token, onClose, onImported }: Props) {
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<any>(null)
  const [csvText,  setCsvText]  = useState("")

  const handleImport = async () => {
    if (!csvText.trim()) return
    setLoading(true)
    try {
      const Papa = await import("papaparse")
      const parsed = Papa.default.parse(csvText, { header: true, skipEmptyLines: true })
      const res = await crmApi.importContacts(token, parsed.data as any[])
      if (res.success) setResult(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Importer des contacts CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">x</button>
        </div>

        {!result ? (
          <>
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <p className="text-gray-400 text-xs font-medium mb-1">Format CSV attendu :</p>
              <p className="text-gray-500 text-xs font-mono">first_name,last_name,email,phone,company,job_title,status</p>
              <p className="text-gray-500 text-xs font-mono">Jean,Tremblay,jean@acme.com,+15141234567,Acme,DG,CLIENT</p>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Coller le contenu CSV ici..."
              rows={8}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none mb-3 font-mono text-xs"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-700 text-gray-300 py-2 rounded-lg text-sm">
                Annuler
              </button>
              <button onClick={handleImport} disabled={loading || !csvText.trim()}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium"
              >
                {loading ? "Import en cours..." : "Importer"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">Import termine !</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-green-400 font-bold text-lg">{result.imported}</p>
                <p className="text-gray-500 text-xs">Importes</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-amber-400 font-bold text-lg">{result.skipped}</p>
                <p className="text-gray-500 text-xs">Ignores</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-blue-400 font-bold text-lg">{result.total}</p>
                <p className="text-gray-500 text-xs">Total</p>
              </div>
            </div>
            <button onClick={onImported} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg text-sm">
              Voir les contacts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
