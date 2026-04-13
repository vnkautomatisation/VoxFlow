'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) } })
    return r.json()
  }
}

function flag(code: string): string {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397))
}

export default function CommanderDIDPage() {
  const api = useApi()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [countries, setCountries] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [available, setAvailable] = useState<any[]>([])
  const [actions, setActions] = useState<any>(null)
  const [identities, setIdentities] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingRegions, setLoadingRegions] = useState(false)
  const [loadingNumbers, setLoadingNumbers] = useState(false)

  // Selection state
  const [selectedCountry, setSelectedCountry] = useState<any>(null)
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedNumber, setSelectedNumber] = useState('')
  const [selectedActionType, setSelectedActionType] = useState('')
  const [selectedActionId, setSelectedActionId] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIdentity, setSelectedIdentity] = useState('')
  const [pricing, setPricing] = useState<any>(null)

  const flash = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  // Load countries
  useEffect(() => {
    api('/api/v1/telephony/did/countries').then(r => { if (r.success) setCountries(r.data || []) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load regions on country change
  useEffect(() => {
    if (!selectedCountry) return
    setLoadingRegions(true)
    setRegions([]); setAvailable([]); setSelectedRegion(''); setSelectedNumber('')
    api(`/api/v1/telephony/did/regions/${selectedCountry.countryCode}`).then(r => {
      if (r.success) setRegions(r.data || [])
      setLoadingRegions(false)
    })
    api(`/api/v1/telephony/did/pricing/${selectedCountry.countryCode}`).then(r => {
      if (r.success && r.data?.[0]) setPricing(r.data[0])
    })
  }, [selectedCountry]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load available numbers on region change
  useEffect(() => {
    if (!selectedCountry || !selectedRegion) return
    setLoadingNumbers(true); setAvailable([]); setSelectedNumber('')
    api(`/api/v1/telephony/did/available?countryCode=${selectedCountry.countryCode}&areaCode=${selectedRegion}&type=local`).then(r => {
      if (r.success) setAvailable(r.data || [])
      setLoadingNumbers(false)
    })
  }, [selectedRegion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load actions for step 2
  useEffect(() => {
    if (step === 2 && !actions) {
      api('/api/v1/telephony/did/actions').then(r => { if (r.success) setActions(r.data) })
    }
    if (step === 3) {
      api('/api/v1/telephony/did/identities').then(r => { if (r.success) setIdentities(r.data || []) })
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrder = async () => {
    setSubmitting(true)
    const res = await api('/api/v1/telephony/did/order', {
      method: 'POST',
      body: JSON.stringify({
        countryCode: selectedCountry?.countryCode, areaCode: selectedRegion, specificPhoneNumber: selectedNumber || null,
        didType: 'local', assignedActionType: selectedActionType || null, assignedActionId: selectedActionId || null,
        description, identityId: selectedIdentity || null,
      }),
    })
    if (res.success) { flash(`Numero ${res.data?.phoneNumber} active`); router.push('/client/numbers') }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }

  const filteredCountries = countries.filter(c => !search || c.countryName.toLowerCase().includes(search.toLowerCase()) || c.countryCode.toLowerCase().includes(search.toLowerCase()))
  const approvedIdentities = identities.filter(i => i.status === 'approved')
  const needsDocuments = selectedCountry?.requiresDocuments

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>{toast.msg}</div>}

      {/* Stepper */}
      <div className="w-[260px] bg-[#0c0c16] border-r border-[#2e2e44] p-6 flex-shrink-0">
        <div className="text-[13px] text-[#55557a] mb-6">Commander un numero</div>
        {['Choisir l\'emplacement', 'Choisir l\'action', 'Detail commande'].map((label, i) => {
          const num = i + 1; const active = step === num; const done = step > num
          return (
            <div key={i} className="flex items-center gap-3 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${active ? 'bg-[#7b61ff] text-white' : done ? 'bg-emerald-600 text-white' : 'bg-[#1e1e2a] text-[#55557a]'}`}>
                {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : num}
              </div>
              <span className={`text-[13px] ${active ? 'text-[#eeeef8] font-semibold' : done ? 'text-emerald-400' : 'text-[#55557a]'}`}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">

        {/* Step 1: Location */}
        {step === 1 && (
          <div>
            <h2 className="text-[20px] font-bold text-[#eeeef8] mb-5">Choisir l&apos;emplacement</h2>

            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un pays..." className="w-full max-w-[400px] bg-[#111118] border border-[#2e2e44] rounded-lg px-4 py-2.5 text-[13px] text-[#eeeef8] outline-none mb-5" />

            {/* Country select */}
            <div className="grid grid-cols-3 gap-3 mb-6 max-h-[300px] overflow-y-auto">
              {filteredCountries.map(c => (
                <div key={c.countryCode + c.types?.join()} onClick={() => setSelectedCountry(c)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border-2 transition-all ${selectedCountry?.countryCode === c.countryCode ? 'border-[#7b61ff] bg-[#7b61ff]/5' : 'border-[#2e2e44] bg-[#18181f] hover:border-[#3e3e5a]'}`}>
                  <span className="text-[18px]">{c.flag}</span>
                  <div>
                    <div className="text-[13px] font-semibold text-[#eeeef8]">{c.countryName}</div>
                    <div className="text-[11px] text-[#7b61ff]">a partir de {c.minPrice} CAD$/mois</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Region + numbers */}
            {selectedCountry && (
              <div className="mb-6">
                <label className="text-[12px] text-[#9898b8] mb-2 block">Region / indicatif</label>
                {loadingRegions ? <div className="text-[12px] text-[#55557a]">Chargement des regions...</div> : (
                  <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
                    className="w-full max-w-[400px] bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                    <option value="">Selectionner une region</option>
                    {regions.map((r, i) => <option key={i} value={r.areaCode}>{r.region} {r.areaCode ? `(${r.areaCode})` : ''}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Available numbers */}
            {selectedRegion && (
              <div className="mb-6">
                <label className="text-[12px] text-[#9898b8] mb-2 block">Numeros disponibles</label>
                {loadingNumbers ? <div className="text-[12px] text-[#55557a]">Recherche de numeros...</div> : available.length === 0 ? <div className="text-[12px] text-[#55557a]">Aucun numero disponible.</div> : (
                  <div className="flex flex-col gap-2">
                    <div onClick={() => setSelectedNumber('')}
                      className={`px-4 py-2.5 rounded-lg cursor-pointer border ${!selectedNumber ? 'border-[#7b61ff] bg-[#7b61ff]/5' : 'border-[#2e2e44] bg-[#18181f]'} text-[13px] text-[#9898b8]`}>
                      Attribution automatique
                    </div>
                    {available.map(n => (
                      <div key={n.phoneNumber} onClick={() => setSelectedNumber(n.phoneNumber)}
                        className={`px-4 py-2.5 rounded-lg cursor-pointer border ${selectedNumber === n.phoneNumber ? 'border-[#7b61ff] bg-[#7b61ff]/5' : 'border-[#2e2e44] bg-[#18181f]'}`}>
                        <span className="text-[13px] text-[#eeeef8] font-mono">{n.phoneNumber}</span>
                        {n.locality && <span className="text-[12px] text-[#55557a] ml-2">— {n.locality}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pricing info */}
            {pricing && (
              <div className="bg-[#111118] border border-[#2e2e44] rounded-lg p-4 mb-6 max-w-[500px]">
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="text-[#9898b8]">Adresse requise</div><div className="text-[#eeeef8]">{pricing.requires_address ? 'Oui' : 'Non'}</div>
                  <div className="text-[#9898b8]">Documents requis</div><div className="text-[#eeeef8]">{pricing.requires_documents ? 'Oui' : 'Non'}</div>
                  <div className="text-[#9898b8]">Approvisionnement</div><div className="text-[#eeeef8]">{pricing.provisioning_time}</div>
                  <div className="text-[#9898b8]">Prix</div><div className="text-[#7b61ff] font-bold">{pricing.price_monthly} CAD$/mois</div>
                </div>
                {pricing.provisioning_description && <div className="text-[11px] text-[#55557a] mt-2">{pricing.provisioning_description}</div>}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => router.push('/client/numbers')} className="px-5 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer">Annuler</button>
              <button onClick={() => { if (selectedCountry) setStep(2) }} disabled={!selectedCountry}
                className={`px-5 py-2.5 rounded-lg text-[13px] font-bold border-none cursor-pointer ${selectedCountry ? 'bg-[#7b61ff] text-white hover:bg-[#6145ff]' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Action */}
        {step === 2 && (
          <div>
            <h2 className="text-[20px] font-bold text-[#eeeef8] mb-3">Choisir l&apos;action</h2>
            <p className="text-[13px] text-[#55557a] mb-5">Choisissez l&apos;action declenchee lors d&apos;un appel entrant sur ce numero.</p>

            <div className="max-w-[500px] space-y-4">
              <div>
                <label className="text-[12px] text-[#9898b8] mb-1 block">Action entrante</label>
                <select value={selectedActionType} onChange={e => { setSelectedActionType(e.target.value); setSelectedActionId('') }}
                  className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                  <option value="">Aucune action</option>
                  <option value="extension">Extension</option>
                  <option value="queue">File d&apos;attente</option>
                  <option value="voicemail">Messagerie vocale</option>
                </select>
              </div>

              {selectedActionType && actions && (
                <div>
                  <label className="text-[12px] text-[#9898b8] mb-1 block">Cible</label>
                  <select value={selectedActionId} onChange={e => setSelectedActionId(e.target.value)}
                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                    <option value="">Selectionner...</option>
                    {selectedActionType === 'extension' && (actions.extensions || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    {selectedActionType === 'queue' && (actions.queues || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    {selectedActionType === 'voicemail' && (actions.voicemails || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[12px] text-[#9898b8] mb-1 block">Description (optionnel)</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Ligne principale"
                  className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer">Retour</button>
              <button onClick={() => setStep(3)} className="px-5 py-2.5 bg-[#7b61ff] text-white rounded-lg text-[13px] font-bold border-none cursor-pointer hover:bg-[#6145ff]">Suivant</button>
            </div>
          </div>
        )}

        {/* Step 3: Summary + order */}
        {step === 3 && (
          <div>
            <h2 className="text-[20px] font-bold text-[#eeeef8] mb-5">Detail commande</h2>

            {/* Identity requirement */}
            {needsDocuments && (
              <div className="mb-5">
                <label className="text-[12px] text-[#9898b8] mb-2 block">Identite requise pour {selectedCountry?.countryName}</label>
                {approvedIdentities.length > 0 ? (
                  <select value={selectedIdentity} onChange={e => setSelectedIdentity(e.target.value)}
                    className="w-full max-w-[400px] bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                    <option value="">Selectionner une identite</option>
                    {approvedIdentities.map(i => <option key={i.id} value={i.id}>{i.name} — {i.country_code}</option>)}
                  </select>
                ) : (
                  <div className="bg-orange-950/30 border border-orange-800/30 rounded-lg p-4 text-[13px] text-orange-300">
                    Aucune identite approuvee. <a href="/client/numbers/identities" className="text-[#7b61ff] underline">Soumettez une identite</a> et attendez la validation (24-48h).
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="bg-[#111118] border border-[#2e2e44] rounded-xl p-5 mb-6 max-w-[500px] space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-[#9898b8]">Pays</span><span className="text-[#eeeef8]">{selectedCountry?.flag} {selectedCountry?.countryName}</span></div>
              {selectedRegion && <div className="flex justify-between"><span className="text-[#9898b8]">Region</span><span className="text-[#eeeef8]">{selectedRegion}</span></div>}
              <div className="flex justify-between"><span className="text-[#9898b8]">Numero</span><span className="text-[#eeeef8] font-mono">{selectedNumber || 'Attribution automatique'}</span></div>
              {selectedActionType && <div className="flex justify-between"><span className="text-[#9898b8]">Action</span><span className="text-[#eeeef8]">{selectedActionType}</span></div>}
              <div className="flex justify-between font-bold border-t border-[#2e2e44] pt-2 mt-2">
                <span className="text-[#eeeef8]">Prix mensuel</span>
                <span className="text-[#7b61ff]">{pricing?.price_monthly || selectedCountry?.minPrice || 0} CAD$/mois</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer">Retour</button>
              <button onClick={handleOrder} disabled={submitting || (needsDocuments && !selectedIdentity)}
                className={`px-6 py-2.5 rounded-lg text-[13px] font-bold border-none cursor-pointer ${!submitting && (!needsDocuments || selectedIdentity) ? 'bg-[#7b61ff] text-white hover:bg-[#6145ff]' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>
                {submitting ? 'Traitement...' : 'Finaliser la commande'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
