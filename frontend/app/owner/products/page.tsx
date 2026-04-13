'use client'
import { useState, useEffect } from 'react'

const API = () => localStorage.getItem('vf_url') || 'http://localhost:4000'
const TOK = () => localStorage.getItem('vf_tok') || ''
const api = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API() + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...opts.headers as any } })
  return r.json()
}

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await api('/api/v1/owner/products')
    if (r.success) setProducts(r.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    const sku = prompt('SKU (ex: CA-LOCAL-MTL)')
    if (!sku) return
    const name = prompt('Nom du produit')
    if (!name) return
    const price = prompt('Prix mensuel (cents CAD)', '500')
    await api('/api/v1/owner/products', { method: 'POST', body: JSON.stringify({ sku, name, category: 'PHONE_NUMBER', country: 'CA', price_monthly: Number(price) || 500 }) })
    load()
  }

  const del = async (id: string) => {
    if (!confirm('Desactiver ce produit ?')) return
    await api(`/api/v1/owner/products/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div className="p-8 text-[#55557a] text-sm">Chargement...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8]">Catalogue produits</h1>
          <p className="text-xs text-[#55557a]">{products.length} produits</p>
        </div>
        <button onClick={create} className="text-xs bg-[#7b61ff] text-white px-4 py-2 rounded-lg font-bold">+ Produit</button>
      </div>
      <div className="space-y-2">
        {products.map((p: any) => (
          <div key={p.id} className="bg-[#18181f] border border-[#2e2e44] rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-[#7b61ff]">{p.sku}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${p.is_active ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : 'bg-[#ff4d6d]/15 text-[#ff4d6d]'}`}>
                  {p.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="text-sm font-semibold text-[#eeeef8]">{p.name}</div>
              <div className="text-[10px] text-[#55557a]">{p.category} {p.country ? `· ${p.country}` : ''} {p.region ? `· ${p.region}` : ''}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-bold text-[#7b61ff]">{((p.price_monthly || 0) / 100).toFixed(2)} CAD</div>
                <div className="text-[9px] text-[#55557a]">/mois</div>
              </div>
              <button onClick={() => del(p.id)} className="text-[10px] text-[#ff4d6d55] hover:text-[#ff4d6d]">Desactiver</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <div className="text-xs text-[#35355a] text-center py-8 border border-dashed border-[#2e2e44] rounded-xl">Aucun produit dans le catalogue</div>}
      </div>
    </div>
  )
}
