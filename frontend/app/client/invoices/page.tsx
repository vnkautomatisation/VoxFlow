'use client'

import { useState, useCallback, useEffect } from 'react'

interface InvoiceLine { description: string; qty: number; unitPrice: number; total: number }
interface Invoice {
  id: string; number: string; period: string; date: string; dueDate: string
  status: 'paid' | 'pending' | 'overdue'
  subtotal: number; tps: number; tvq: number; total: number
  lines: InvoiceLine[]
  org: { name: string; address: string; email: string }
}
interface CardInfo { last4: string; brand: string; expMonth: string; expYear: string; name: string }

// ─── Partage carte globale (simple state lifting via callback) ───────────────
let _savedCard: CardInfo | null = null
export function getSavedCard() { return _savedCard }
export function setSavedCard(c: CardInfo | null) { _savedCard = c }

// ─── Modal paiement ──────────────────────────────────────────────────────────
function PaymentModal({
  invoice, savedCard, onClose, onSuccess
}: {
  invoice: Invoice
  savedCard: CardInfo | null
  onClose: () => void
  onSuccess: (card: CardInfo) => void
}) {
  const [useNew, setUseNew] = useState(!savedCard)
  const [num,   setNum]   = useState('')
  const [exp,   setExp]   = useState('')
  const [cvc,   setCvc]   = useState('')
  const [name,  setName]  = useState('')
  const [save,  setSave]  = useState(true)
  const [focus, setFocus] = useState<string | null>(null)
  const [err,   setErr]   = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [done,  setDone]  = useState(false)

  const fmt4 = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()
  const fmtE = (v: string) => { const d = v.replace(/\D/g,'').slice(0,4); return d.length>2 ? d.slice(0,2)+' / '+d.slice(2) : d }
  const brand = (n: string) => { const d=n.replace(/\s/g,''); return d[0]==='4'?'VISA':d[0]==='5'||d[0]==='2'?'MC':d[0]==='3'?'AMEX':'' }

  const pay = async () => {
    setErr(null)
    let card: CardInfo
    if (savedCard && !useNew) {
      card = savedCard
    } else {
      const n = num.replace(/\s/g,'')
      if (n.length < 16) return setErr('Numéro de carte invalide')
      const parts = exp.replace(/\s/g,'').split('/')
      if (!parts[0] || !parts[1] || parseInt(parts[0]) > 12) return setErr('Date d\'expiration invalide')
      if (cvc.length < 3) return setErr('Code CVC invalide')
      if (!name.trim()) return setErr('Nom du titulaire requis')
      card = { last4: n.slice(-4), brand: brand(num)||'VISA', expMonth: parts[0], expYear: parts[1], name }
    }
    setPaying(true)
    await new Promise(r => setTimeout(r, 1100))
    setDone(true)
    await new Promise(r => setTimeout(r, 800))
    onSuccess(card)
    setPaying(false)
  }

  const inp = (f: boolean): React.CSSProperties => ({
    width: '100%', background: f ? '#0d0d1e' : '#080810',
    border: `1px solid ${f ? '#7b61ff' : '#2a2a4a'}`, borderRadius: 10,
    padding: '11px 14px', color: '#e8e8f8', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .15s', fontFamily: 'inherit',
  })

  if (done) return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#0c0c1a', border:'1px solid #00d4aa44', borderRadius:20, padding:48, textAlign:'center', width:360 }}>
        <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:18, fontWeight:700, color:'#00d4aa', marginBottom:8 }}>Paiement réussi</div>
        <div style={{ fontSize:13, color:'#6a6a8a' }}>Facture {invoice.number} réglée</div>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#0c0c1a', border:'1px solid #2a2a4a', borderRadius:20, padding:32, width:480, maxWidth:'95vw' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#e8e8f8' }}>Payer la facture</div>
            <div style={{ fontSize:12, color:'#4a4a6a', marginTop:3 }}>{invoice.number} · {invoice.period}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#5a5a7a', cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        {/* Montant */}
        <div style={{ background:'#080810', border:'1px solid #2a2a4a', borderRadius:10, padding:'14px 18px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12, color:'#6a6a8a' }}>Montant total dû</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#7b61ff' }}>{invoice.total.toFixed(2)} $</div>
        </div>

        {/* Carte enregistrée */}
        {savedCard && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Méthode de paiement</div>
            <div
              onClick={() => setUseNew(false)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background: !useNew ? '#7b61ff18' : '#080810', border:`1px solid ${!useNew ? '#7b61ff55' : '#2a2a4a'}`, borderRadius:10, cursor:'pointer', marginBottom:8, transition:'all .15s' }}
            >
              <div style={{ width:36, height:24, background:'linear-gradient(135deg,#1a1a3a,#0e0e2a)', border:'1px solid #3a3a5a', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color:'#7b61ff' }}>{savedCard.brand}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'#c8c8e8', fontFamily:'monospace' }}>•••• {savedCard.last4}</div>
                <div style={{ fontSize:10, color:'#5a5a7a' }}>{savedCard.name} · Exp. {savedCard.expMonth}/{savedCard.expYear}</div>
              </div>
              {!useNew && <span style={{ color:'#00d4aa', fontSize:16 }}>✓</span>}
            </div>
            <div
              onClick={() => setUseNew(true)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background: useNew ? '#7b61ff18' : 'transparent', border:`1px solid ${useNew ? '#7b61ff55' : '#2a2a4a'}`, borderRadius:10, cursor:'pointer', fontSize:13, color: useNew ? '#a695ff' : '#5a5a7a', transition:'all .15s' }}
            >
              + Utiliser une autre carte
            </div>
          </div>
        )}

        {/* Formulaire nouvelle carte */}
        {(!savedCard || useNew) && (
          <>
            {/* Carte visuelle */}
            <div style={{ background:'linear-gradient(135deg,#1a1a3a 0%,#0e0e2a 100%)', border:'1px solid #2a2a5a', borderRadius:12, padding:'16px 20px', marginBottom:18, position:'relative', overflow:'hidden', minHeight:72 }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'#7b61ff11', border:'1px solid #7b61ff22' }} />
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:10, color:'#5a5a8a', letterSpacing:'.1em', textTransform:'uppercase' }}>VoxFlow Pay</div>
                <div style={{ fontSize:12, fontWeight:800, color: brand(num)==='VISA'?'#4a8ef8': brand(num)==='MC'?'#eb6b1b':'#7b61ff' }}>{brand(num)||'—'}</div>
              </div>
              <div style={{ fontFamily:'monospace', fontSize:15, color: num?'#c8c8e8':'#3a3a5a', letterSpacing:'.18em', marginBottom:8 }}>{num||'•••• •••• •••• ••••'}</div>
              <div style={{ display:'flex', gap:20, fontSize:11 }}>
                <div><span style={{ color:'#4a4a6a', display:'block', fontSize:9 }}>TITULAIRE</span><span style={{ color: name?'#a8a8c8':'#3a3a5a' }}>{name||'NOM PRÉNOM'}</span></div>
                <div><span style={{ color:'#4a4a6a', display:'block', fontSize:9 }}>EXP.</span><span style={{ color: exp?'#a8a8c8':'#3a3a5a' }}>{exp||'MM / AA'}</span></div>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Numéro de carte</label>
                <input value={num} onChange={e=>setNum(fmt4(e.target.value))} onFocus={()=>setFocus('n')} onBlur={()=>setFocus(null)} placeholder="1234 5678 9012 3456" maxLength={19} style={inp(focus==='n')} />
              </div>
              <div>
                <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Nom du titulaire</label>
                <input value={name} onChange={e=>setName(e.target.value.toUpperCase())} onFocus={()=>setFocus('nm')} onBlur={()=>setFocus(null)} placeholder="NOM PRÉNOM" style={inp(focus==='nm')} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Expiration</label>
                  <input value={exp} onChange={e=>setExp(fmtE(e.target.value))} onFocus={()=>setFocus('e')} onBlur={()=>setFocus(null)} placeholder="MM / AA" maxLength={7} style={inp(focus==='e')} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>CVC</label>
                  <input value={cvc} onChange={e=>setCvc(e.target.value.replace(/\D/g,'').slice(0,4))} onFocus={()=>setFocus('c')} onBlur={()=>setFocus(null)} placeholder="•••" maxLength={4} style={{ ...inp(focus==='c'), letterSpacing:'.3em' }} />
                </div>
              </div>
              {/* Option sauvegarder */}
              <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, color:'#7878a0', marginTop:2 }}>
                <input type="checkbox" checked={save} onChange={e=>setSave(e.target.checked)} style={{ accentColor:'#7b61ff' }} />
                Sauvegarder cette carte pour les prochains paiements
              </label>
            </div>
          </>
        )}

        {err && <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8, background:'#ff4d6d18', border:'1px solid #ff4d6d33', fontSize:12, color:'#ff4d6d' }}>{err}</div>}

        <button onClick={pay} disabled={paying} style={{ width:'100%', padding:'13px', background: paying?'#5a4abf':'#7b61ff', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor: paying?'default':'pointer' }}>
          {paying ? 'Traitement…' : `🔒 Payer ${invoice.total.toFixed(2)} $`}
        </button>
        <div style={{ marginTop:10, textAlign:'center', fontSize:11, color:'#3a3a5a' }}>Paiement chiffré · Sécurisé TLS 256-bit</div>
      </div>
    </div>
  )
}

// ─── Prévisualisation facture ────────────────────────────────────────────────
function InvoicePreview({ inv, onClose, onPay, savedCard }: {
  inv: Invoice; onClose: () => void; onPay?: () => void; savedCard: CardInfo | null
}) {
  const sc = (s: string) => s==='paid'?'#00d4aa':s==='overdue'?'#ff4d6d':'#ffb547'
  const sl = (s: string) => s==='paid'?'Payée':s==='overdue'?'En retard':'En attente'

  const print = () => {
    const body = document.getElementById('inv-body')
    if (!body) return
    const w = window.open('','_blank')!
    w.document.write(`<html><head><title>${inv.number}</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}</style></head><body>${body.outerHTML}</body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:100, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:720, maxWidth:'100%', marginTop:8, marginBottom:8 }}>
        {/* Barre actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'10px 16px', background:'#1a1a2e', border:'1px solid #2a2a4a', borderRadius:10 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#c8c8e8' }}>📄 {inv.number} — {inv.period}</div>
          <div style={{ display:'flex', gap:8 }}>
            {inv.status !== 'paid' && onPay && (
              <button onClick={onPay} style={{ padding:'6px 16px', background:'#ff4d6d', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                💳 Payer {inv.total.toFixed(2)} $
              </button>
            )}
            <button onClick={print} style={{ padding:'6px 14px', background:'#7b61ff', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>⬇ PDF</button>
            <button onClick={onClose} style={{ padding:'6px 12px', background:'transparent', border:'1px solid #2a2a4a', borderRadius:7, color:'#5a5a7a', fontSize:12, cursor:'pointer' }}>✕</button>
          </div>
        </div>

        {/* Corps facture blanc */}
        <div id="inv-body" style={{ background:'#ffffff', borderRadius:12, overflow:'hidden', boxShadow:'0 20px 60px #00000088' }}>
          <div style={{ background:'linear-gradient(135deg,#1a0a3a 0%,#0e0a2a 100%)', padding:'28px 36px', color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:22, fontWeight:900, marginBottom:4 }}><span style={{ color:'#7b61ff' }}>Vox</span>Flow</div>
                <div style={{ fontSize:11, color:'#9898b8', lineHeight:1.7 }}>VNK Automatisation Inc.<br/>1234, rue Sherbrooke Ouest<br/>Montréal (QC) H3G 1L7<br/>facturation@voxflow.io</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:24, fontWeight:900 }}>FACTURE</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#7b61ff', marginTop:4 }}>{inv.number}</div>
                <div style={{ marginTop:8, display:'inline-block', padding:'3px 12px', borderRadius:20, background:sc(inv.status)+'22', border:`1px solid ${sc(inv.status)}55`, color:sc(inv.status), fontSize:11, fontWeight:700 }}>{sl(inv.status)}</div>
              </div>
            </div>
          </div>

          <div style={{ padding:'20px 36px', background:'#f8f8ff', borderBottom:'1px solid #e8e8f0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
            {[['Période',inv.period],['Émission',inv.date],['Échéance',inv.dueDate]].map(([k,v])=>(
              <div key={k}><div style={{ fontSize:10, color:'#8888a0', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{k}</div><div style={{ fontSize:13, fontWeight:600, color:'#1a1a3a' }}>{v}</div></div>
            ))}
          </div>

          <div style={{ padding:'20px 36px', borderBottom:'1px solid #e8e8f0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div>
              <div style={{ fontSize:10, color:'#8888a0', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>De</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a3a', marginBottom:3 }}>VNK Automatisation Inc.</div>
              <div style={{ fontSize:12, color:'#5a5a7a', lineHeight:1.7 }}>1234, rue Sherbrooke Ouest<br/>Montréal (QC) H3G 1L7<br/>TPS : 123 456 789 RT0001<br/>TVQ : 1234567890 TQ0001</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#8888a0', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Facturer à</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a3a', marginBottom:3 }}>{inv.org.name}</div>
              <div style={{ fontSize:12, color:'#5a5a7a', lineHeight:1.7 }}>{inv.org.address}<br/>{inv.org.email}</div>
            </div>
          </div>

          <div style={{ padding:'0 36px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ borderBottom:'2px solid #e8e8f0' }}>
                {['Description','Qté','Prix unit.','Total'].map((h,i)=>(
                  <th key={h} style={{ padding:'12px 0', textAlign:i===0?'left':'right', fontSize:10, color:'#8888a0', textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {inv.lines.map((l,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid #f0f0f8' }}>
                    <td style={{ padding:'11px 0', fontSize:12, color:'#2a2a4a' }}>{l.description}</td>
                    <td style={{ padding:'11px 0', textAlign:'right', fontSize:12, color:'#5a5a7a' }}>{l.qty}</td>
                    <td style={{ padding:'11px 0', textAlign:'right', fontSize:12, color:'#5a5a7a' }}>{l.unitPrice.toFixed(2)} $</td>
                    <td style={{ padding:'11px 0', textAlign:'right', fontSize:12, fontWeight:600, color:'#1a1a3a' }}>{l.total.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding:'16px 36px 28px', display:'flex', justifyContent:'flex-end' }}>
            <div style={{ width:240 }}>
              {[['Sous-total',inv.subtotal],['TPS (5%)',inv.tps],['TVQ (9,975%)',inv.tvq]].map(([k,v])=>(
                <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:12, color:'#5a5a7a', borderBottom:'1px solid #f0f0f8' }}>
                  <span>{k}</span><span>{(v as number).toFixed(2)} $</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', fontSize:16, fontWeight:800, color:'#1a1a3a' }}>
                <span>Total CAD</span><span style={{ color:'#7b61ff' }}>{inv.total.toFixed(2)} $</span>
              </div>
            </div>
          </div>

          <div style={{ background:'#f8f8ff', borderTop:'1px solid #e8e8f0', padding:'14px 36px', display:'flex', justifyContent:'space-between' }}>
            <div style={{ fontSize:10, color:'#9898b0' }}>Merci de votre confiance · VoxFlow par VNK Automatisation</div>
            <div style={{ fontSize:10, color:'#9898b0' }}>voxflow.io · facturation@voxflow.io</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────
// API helper — lit token + url depuis localStorage
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
      body: opts.body,
    })
    return r.json()
  }
}

// Mapper une row invoices Supabase (migration 013) → forme UI
function mapInvoice(row: any): Invoice {
  const items: any[] = Array.isArray(row.items) ? row.items : []
  const subtotal = items.reduce((s, l) => s + Number(l.total || 0), 0)
  const total    = Number(row.amount || subtotal)
  const tax      = Number(row.amount_tax || 0)
  // Taxes Quebec : TPS 5% + TVQ 9.975% ≈ 14.975%
  const tps = tax * (5 / 14.975)
  const tvq = tax - tps
  return {
    id:       row.id,
    number:   row.number,
    period:   row.period || '',
    date:     row.date ? String(row.date).slice(0, 10) : '',
    dueDate:  row.due_date ? String(row.due_date).slice(0, 10) : '',
    status:   (row.status || 'pending').toLowerCase() as Invoice['status'],
    subtotal,
    tps,
    tvq,
    total,
    lines:    items.map((l: any) => ({
      description: String(l.description || ''),
      qty:         Number(l.qty || 1),
      unitPrice:   Number(l.unit_price || l.unitPrice || 0),
      total:       Number(l.total || 0),
    })),
    org: {
      name:    '',
      address: '',
      email:   '',
    },
  }
}

export default function InvoicesPage() {
  const api = useApi()
  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [loading,  setLoading]      = useState(true)
  const [error,    setError]        = useState<string | null>(null)
  const [selected, setSelected]     = useState<Invoice | null>(null)
  const [paying,   setPaying]       = useState<Invoice | null>(null)
  const [savedCard, setSavedCardSt] = useState<CardInfo | null>(null)
  const [toast,    setToast]        = useState<string | null>(null)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api('/api/v1/billing/invoices')
      if (r.success && Array.isArray(r.data)) {
        setInvoices(r.data.map(mapInvoice))
      } else {
        setInvoices([])
        if (r.error || r.message) setError(r.error || r.message)
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les factures')
      setInvoices([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const handlePaid = useCallback((inv: Invoice, card: CardInfo) => {
    // Marquer la facture comme payée
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' as const } : i))
    // Sauvegarder la carte
    setSavedCardSt(card)
    _savedCard = card
    // Fermer les modals
    setPaying(null)
    setSelected(null)
    showToast(`✓ Facture ${inv.number} payée · Carte •••• ${card.last4} enregistrée`)
  }, [])

  const sc = (s: string) => s==='paid'?'#00d4aa':s==='overdue'?'#ff4d6d':'#ffb547'
  const sl = (s: string) => s==='paid'?'Payée':s==='overdue'?'En retard':'En attente'

  const totalPaid  = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.total,0)
  const countPaid  = invoices.filter(i=>i.status==='paid').length
  const countPend  = invoices.filter(i=>i.status==='pending').length
  const countLate  = invoices.filter(i=>i.status==='overdue').length
  const totalDue   = invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.total,0)

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:300, padding:'12px 20px', background:'#00d4aa18', border:'1px solid #00d4aa55', borderRadius:10, fontSize:13, color:'#00d4aa', boxShadow:'0 4px 20px #00000066' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#e8e8f8', margin:0, marginBottom:6 }}>Factures</h1>
        <p style={{ fontSize:13, color:'#6a6a8a', margin:0 }}>Consultez, payez et téléchargez vos factures.</p>
      </div>

      {/* Alerte facture en retard */}
      {countLate > 0 && (
        <div style={{ marginBottom:16, padding:'12px 18px', background:'#ff4d6d12', border:'1px solid #ff4d6d44', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:13, color:'#ff8888' }}>
            ⚠ {countLate} facture{countLate>1?'s':''} en retard · {totalDue.toFixed(2)} $ dû
          </div>
          <button
            onClick={() => { const late = invoices.find(i=>i.status==='overdue'); if (late) setPaying(late) }}
            style={{ padding:'6px 14px', background:'#ff4d6d', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}
          >
            Payer maintenant
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Total payé',       value: totalPaid.toFixed(2)+' $', color:'#00d4aa' },
          { label:'Factures payées',  value: countPaid,                 color:'#7b61ff' },
          { label:'En attente',       value: countPend,                 color:'#ffb547' },
          { label:'En retard',        value: countLate,                 color:'#ff4d6d' },
        ].map(s=>(
          <div key={s.label} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:10, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Carte enregistrée */}
      {savedCard && (
        <div style={{ marginBottom:16, padding:'10px 16px', background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:10, display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
          <span style={{ color:'#4a4a6a' }}>Carte enregistrée :</span>
          <span style={{ color:'#c8c8e8', fontFamily:'monospace' }}>{savedCard.brand} •••• {savedCard.last4}</span>
          <span style={{ color:'#4a4a6a' }}>— utilisée automatiquement pour les prochains paiements</span>
          <button onClick={() => setSavedCardSt(null)} style={{ marginLeft:'auto', background:'transparent', border:'1px solid #ff4d6d33', borderRadius:6, color:'#ff4d6d77', fontSize:11, padding:'3px 8px', cursor:'pointer' }}>Retirer</button>
        </div>
      )}

      {/* Liste */}
      <div style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:12, overflow:'hidden' }}>
        {loading && (
          <div style={{ padding:20, textAlign:'center', color:'#4a4a6a', fontSize:13 }}>Chargement des factures…</div>
        )}
        {!loading && error && (
          <div style={{ padding:16, background:'#ff4d6d10', border:'1px solid #ff4d6d33', borderRadius:10, color:'#ff4d6d', fontSize:13 }}>{error}</div>
        )}
        {!loading && !error && invoices.length === 0 && (
          <div style={{ padding:32, textAlign:'center', color:'#4a4a6a' }}>
            <div style={{ fontSize:14, marginBottom:6 }}>Aucune facture</div>
            <div style={{ fontSize:12, color:'#3a3a5a' }}>Vos factures Stripe apparaitront ici des la premiere periode.</div>
          </div>
        )}
        {invoices.map((inv, i) => (
          <div key={inv.id}
            style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 20px', borderBottom: i<invoices.length-1?'1px solid #1a1a2e':'none', cursor:'pointer', transition:'background .12s' }}
            onMouseEnter={e=>(e.currentTarget.style.background='#13131f')}
            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
            onClick={() => setSelected(inv)}
          >
            <div style={{ width:34, height:34, borderRadius:8, background:'#7b61ff18', border:'1px solid #7b61ff33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>📄</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#c8c8e8' }}>{inv.number}</div>
              <div style={{ fontSize:12, color:'#5a5a7a', marginTop:2 }}>{inv.period}</div>
            </div>
            <div style={{ fontSize:12, color:'#5a5a7a', minWidth:100, textAlign:'right' }}>{inv.date}</div>
            <div style={{ minWidth:80, textAlign:'center' }}>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:sc(inv.status)+'18', color:sc(inv.status), border:`1px solid ${sc(inv.status)}33`, fontWeight:600 }}>{sl(inv.status)}</span>
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:'#e8e8f8', minWidth:90, textAlign:'right' }}>{inv.total.toFixed(2)} $</div>
            <div style={{ display:'flex', gap:6 }} onClick={e=>e.stopPropagation()}>
              {inv.status !== 'paid' && (
                <button onClick={() => setPaying(inv)} style={{ padding:'5px 10px', background:'#ff4d6d18', border:'1px solid #ff4d6d44', borderRadius:6, color:'#ff8888', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                  💳 Payer
                </button>
              )}
              <button onClick={() => setSelected(inv)} style={{ padding:'5px 10px', background:'#7b61ff18', border:'1px solid #7b61ff33', borderRadius:6, color:'#a695ff', fontSize:11, cursor:'pointer' }}>
                👁 Voir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal prévisualisation */}
      {selected && (
        <InvoicePreview
          inv={selected}
          savedCard={savedCard}
          onClose={() => setSelected(null)}
          onPay={selected.status !== 'paid' ? () => { setPaying(selected); setSelected(null) } : undefined}
        />
      )}

      {/* Modal paiement */}
      {paying && (
        <PaymentModal
          invoice={paying}
          savedCard={savedCard}
          onClose={() => setPaying(null)}
          onSuccess={(card) => handlePaid(paying, card)}
        />
      )}
    </div>
  )
}
