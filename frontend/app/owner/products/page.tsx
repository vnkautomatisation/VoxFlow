'use client'
import { useState, useEffect } from 'react'
import { PromptModal, ConfirmModal } from '@/components/shared/VFModal'

const API = () => localStorage.getItem('vf_url') || 'http://localhost:4000'
const TOK = () => localStorage.getItem('vf_tok') || ''
const api = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API() + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...opts.headers as any } })
  return r.json()
}

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const r = await api('/api/v1/owner/products')
    if (r.success) setProducts(r.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const create = async (vals: Record<string, string>) => {
    await api('/api/v1/owner/products', { method: 'POST', body: JSON.stringify({ sku: vals.sku, name: vals.name, category: 'PHONE_NUMBER', country: vals.country || 'CA', price_monthly: Number(vals.price) || 500 }) })
    setShowNew(false)
    load()
  }

  const del = async (id: string) => {
    await api(`/api/v1/owner/products/${id}`, { method: 'DELETE' })
    setDeleting(null)
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
        <button onClick={() => setShowNew(true)} className="text-xs bg-[#7b61ff] text-white px-4 py-2 rounded-lg font-bold">+ Produit</button>
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
              <button onClick={() => setEditProduct(p)} className="text-[10px] text-[#7b61ff] hover:text-[#a695ff] mr-2">Modifier</button>
              <button onClick={() => setDeleting(p.id)} className="text-[10px] text-[#ff4d6d55] hover:text-[#ff4d6d]">Desactiver</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <div className="text-xs text-[#35355a] text-center py-8 border border-dashed border-[#2e2e44] rounded-xl">Aucun produit dans le catalogue</div>}
      </div>

      {showNew && (
        <PromptModal
          title="Nouveau produit"
          fields={[
            { key: 'sku', label: 'SKU', placeholder: 'CA-LOCAL-MTL', required: true },
            { key: 'name', label: 'Nom du produit', placeholder: 'Numero local Montreal', required: true },
            { key: 'country', label: 'Pays', placeholder: 'CA', defaultValue: 'CA' },
            { key: 'price', label: 'Prix mensuel (cents CAD)', placeholder: '500', defaultValue: '500', type: 'number' },
          ]}
          submitLabel="Creer"
          onSubmit={create}
          onCancel={() => setShowNew(false)}
        />
      )}

      {editProduct && (
        <PromptModal
          title="Modifier le produit"
          fields={[
            { key: 'sku', label: 'SKU', defaultValue: editProduct.sku, required: true },
            { key: 'name', label: 'Nom du produit', defaultValue: editProduct.name, required: true },
            { key: 'country', label: 'Pays', defaultValue: editProduct.country || 'CA' },
            { key: 'price', label: 'Prix mensuel (cents CAD)', defaultValue: String(editProduct.price_monthly || 500), type: 'number' as const },
          ]}
          submitLabel="Sauvegarder"
          onSubmit={async vals => {
            await api(`/api/v1/owner/products/${editProduct.id}`, { method: 'PATCH', body: JSON.stringify({ sku: vals.sku, name: vals.name, country: vals.country, price_monthly: Number(vals.price) || 500 }) })
            setEditProduct(null)
            load()
          }}
          onCancel={() => setEditProduct(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Desactiver ce produit ?"
          message="Le produit ne sera plus visible dans le catalogue client."
          confirmLabel="Desactiver"
          danger
          onConfirm={() => del(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
