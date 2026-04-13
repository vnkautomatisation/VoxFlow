'use client'
import { useState, useRef, useEffect } from 'react'

// ── Modal de confirmation (remplace confirm()) ──────────────
interface ConfirmProps {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6">
          <div className="font-bold text-[#eeeef8] mb-2">{title}</div>
          {message && <div className="text-sm text-[#9898b8] mb-4">{message}</div>}
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] py-2.5 rounded-xl text-sm font-bold hover:text-[#eeeef8] transition-colors">{cancelLabel}</button>
            <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${danger ? 'bg-[#ff4d6d] text-white hover:bg-[#e03050]' : 'bg-[#7b61ff] text-white hover:bg-[#6145ff]'}`}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de saisie (remplace prompt()) ──────────────────────
interface PromptField {
  key: string
  label: string
  placeholder?: string
  type?: string
  defaultValue?: string
  required?: boolean
}

interface PromptProps {
  title: string
  fields: PromptField[]
  submitLabel?: string
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
}

export function PromptModal({ title, fields, submitLabel = 'OK', onSubmit, onCancel }: PromptProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(f => { init[f.key] = f.defaultValue || '' })
    return init
  })
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const missing = fields.filter(f => f.required && !values[f.key]?.trim())
    if (missing.length) return
    onSubmit(values)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="px-6 pt-6 pb-2">
            <div className="font-bold text-[#eeeef8] mb-4">{title}</div>
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}{f.required ? ' *' : ''}</label>
                  <input
                    ref={i === 0 ? firstRef : undefined}
                    type={f.type || 'text'}
                    value={values[f.key]}
                    onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 flex gap-3">
            <button type="button" onClick={onCancel} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] py-2.5 rounded-xl text-sm font-bold hover:text-[#eeeef8] transition-colors">Annuler</button>
            <button type="submit" className="flex-1 bg-[#7b61ff] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#6145ff] transition-colors">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
