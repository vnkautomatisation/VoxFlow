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

// ── Modal de saisie enrichie ────────────────────────────────
export interface PromptField {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local' | 'date' | 'time' | 'tel' | 'url' | 'select' | 'textarea' | 'checkbox'
  defaultValue?: string
  required?: boolean
  options?: { value: string; label: string }[]
  rows?: number
  hint?: string
  colSpan?: 1 | 2
}

interface PromptProps {
  title: string
  fields: PromptField[]
  submitLabel?: string
  wide?: boolean
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
  children?: React.ReactNode
}

export function PromptModal({ title, fields, submitLabel = 'OK', wide, onSubmit, onCancel, children }: PromptProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(f => { init[f.key] = f.defaultValue || '' })
    return init
  })
  const [errors, setErrors] = useState<string[]>([])
  const firstRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const missing = fields.filter(f => f.required && !values[f.key]?.trim())
    if (missing.length) {
      setErrors(missing.map(f => f.key))
      return
    }
    setErrors([])
    onSubmit(values)
  }

  const hasGrid = fields.some(f => f.colSpan === 1)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className={`bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full shadow-2xl max-h-[90vh] flex flex-col ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <div className="px-6 pt-6 pb-2 flex-shrink-0">
            <div className="font-bold text-[#eeeef8] mb-4">{title}</div>
          </div>
          <div className="px-6 pb-2 overflow-y-auto flex-1">
            <div className={hasGrid ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
              {fields.map((f, i) => (
                <div key={f.key} className={f.colSpan === 2 || !hasGrid ? 'col-span-2' : ''}>
                  {f.type !== 'checkbox' && (
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">
                      {f.label}{f.required ? ' *' : ''}
                    </label>
                  )}

                  {f.type === 'select' && f.options ? (
                    <select
                      ref={i === 0 ? firstRef as any : undefined}
                      value={values[f.key]}
                      onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                      className={`w-full bg-[#111118] border rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] ${errors.includes(f.key) ? 'border-[#ff4d6d]' : 'border-[#2e2e44]'}`}
                    >
                      <option value="">{f.placeholder || '-- Choisir --'}</option>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      ref={i === 0 ? firstRef as any : undefined}
                      value={values[f.key]}
                      onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={f.rows || 4}
                      className={`w-full bg-[#111118] border rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] resize-none ${errors.includes(f.key) ? 'border-[#ff4d6d]' : 'border-[#2e2e44]'}`}
                    />
                  ) : f.type === 'checkbox' ? (
                    <label className="flex items-center gap-2.5 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={values[f.key] === 'true'}
                        onChange={e => setValues(p => ({ ...p, [f.key]: e.target.checked ? 'true' : 'false' }))}
                        className="w-4 h-4 rounded border-[#2e2e44] bg-[#111118] accent-[#7b61ff]"
                      />
                      <span className="text-sm text-[#eeeef8]">{f.label}</span>
                    </label>
                  ) : (
                    <input
                      ref={i === 0 ? firstRef as any : undefined}
                      type={f.type || 'text'}
                      value={values[f.key]}
                      onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={`w-full bg-[#111118] border rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] ${errors.includes(f.key) ? 'border-[#ff4d6d]' : 'border-[#2e2e44]'}`}
                    />
                  )}

                  {f.hint && <div className="text-[9px] text-[#55557a] mt-1">{f.hint}</div>}
                  {errors.includes(f.key) && <div className="text-[9px] text-[#ff4d6d] mt-1">Ce champ est requis</div>}
                </div>
              ))}
            </div>
            {children}
          </div>
          <div className="px-6 py-4 flex gap-3 flex-shrink-0 border-t border-[#2e2e44]/50">
            <button type="button" onClick={onCancel} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] py-2.5 rounded-xl text-sm font-bold hover:text-[#eeeef8] transition-colors">Annuler</button>
            <button type="submit" className="flex-1 bg-[#7b61ff] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#6145ff] transition-colors">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
