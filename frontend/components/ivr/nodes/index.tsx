'use client'
import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'

const S = {
  node: 'bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 min-w-[180px] shadow-lg',
  title: 'text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5',
  field: 'text-[11px] text-[#9898b8] mb-1',
  input: 'w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-2 py-1 text-[11px] text-[#eeeef8] outline-none focus:border-[#7b61ff]',
  select: 'w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-2 py-1 text-[11px] text-[#eeeef8] outline-none',
  handle: { width: 10, height: 10, background: '#7b61ff', border: '2px solid #2e2e44' },
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
}

// ── Welcome ────────────────────────────────────────────
export const WelcomeNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#00d4aa' }}><Dot color="#00d4aa" />Accueil</div>
    <div className={S.field}>Message :</div>
    <textarea defaultValue={(data as any).message || 'Bienvenue chez VoxFlow.'}
      onChange={e => (data as any).onChange?.('message', e.target.value)}
      className={S.input} rows={2} style={{ resize: 'none' }} />
    <Handle type="source" position={Position.Bottom} style={S.handle} />
  </div>
))
WelcomeNode.displayName = 'WelcomeNode'

// ── Menu DTMF ──────────────────────────────────────────
export const MenuNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#7b61ff' }}><Dot color="#7b61ff" />Menu DTMF</div>
    <div className={S.field}>Annonce :</div>
    <input defaultValue={(data as any).prompt || 'Appuyez sur 1 pour le support, 2 pour les ventes.'}
      onChange={e => (data as any).onChange?.('prompt', e.target.value)}
      className={S.input} />
    <div className={S.field} style={{ marginTop: 6 }}>Touches :</div>
    {['1', '2', '3', '4'].map(k => (
      <Handle key={k} type="source" position={Position.Bottom} id={`dtmf-${k}`}
        style={{ ...S.handle, left: `${15 + parseInt(k) * 20}%` }} />
    ))}
  </div>
))
MenuNode.displayName = 'MenuNode'

// ── Time Check ─────────────────────────────────────────
export const TimeCheckNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#ffb547' }}><Dot color="#ffb547" />Horaires</div>
    <div className={S.field}>Ouvert :</div>
    <div className="flex gap-1">
      <input type="time" defaultValue={(data as any).open || '09:00'} className={S.input}
        onChange={e => (data as any).onChange?.('open', e.target.value)} />
      <input type="time" defaultValue={(data as any).close || '17:00'} className={S.input}
        onChange={e => (data as any).onChange?.('close', e.target.value)} />
    </div>
    <Handle type="source" position={Position.Bottom} id="open" style={{ ...S.handle, left: '30%' }} />
    <Handle type="source" position={Position.Bottom} id="closed" style={{ ...S.handle, left: '70%', background: '#ff4d6d' }} />
  </div>
))
TimeCheckNode.displayName = 'TimeCheckNode'

// ── Transfer ───────────────────────────────────────────
export const TransferNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#38b6ff' }}><Dot color="#38b6ff" />Transfert</div>
    <div className={S.field}>Vers :</div>
    <input defaultValue={(data as any).target || ''} placeholder="Extension ou numero"
      onChange={e => (data as any).onChange?.('target', e.target.value)}
      className={S.input} />
  </div>
))
TransferNode.displayName = 'TransferNode'

// ── Queue ──────────────────────────────────────────────
export const QueueNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#7b61ff' }}><Dot color="#7b61ff" />File d'attente</div>
    <div className={S.field}>Queue :</div>
    <select defaultValue={(data as any).queueId || ''}
      onChange={e => (data as any).onChange?.('queueId', e.target.value)}
      className={S.select}>
      <option value="">Choisir...</option>
    </select>
    <Handle type="source" position={Position.Bottom} style={S.handle} />
  </div>
))
QueueNode.displayName = 'QueueNode'

// ── Voicemail ──────────────────────────────────────────
export const VoicemailNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#ff4d6d' }}><Dot color="#ff4d6d" />Messagerie</div>
    <div className={S.field}>Message :</div>
    <input defaultValue={(data as any).message || 'Laissez un message apres le bip.'}
      onChange={e => (data as any).onChange?.('message', e.target.value)}
      className={S.input} />
  </div>
))
VoicemailNode.displayName = 'VoicemailNode'

// ── Play Audio ─────────────────────────────────────────
export const PlayAudioNode = memo(({ data }: NodeProps) => (
  <div className={S.node}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#00d4aa' }}><Dot color="#00d4aa" />Audio</div>
    <div className={S.field}>URL :</div>
    <input defaultValue={(data as any).audioUrl || ''} placeholder="https://..."
      onChange={e => (data as any).onChange?.('audioUrl', e.target.value)}
      className={S.input} />
    <Handle type="source" position={Position.Bottom} style={S.handle} />
  </div>
))
PlayAudioNode.displayName = 'PlayAudioNode'

// ── Hang Up ────────────────────────────────────────────
export const HangUpNode = memo(({ data }: NodeProps) => (
  <div className={S.node} style={{ borderColor: '#ff4d6d33' }}>
    <Handle type="target" position={Position.Top} style={S.handle} />
    <div className={S.title} style={{ color: '#ff4d6d' }}><Dot color="#ff4d6d" />Raccrocher</div>
    <div className="text-[10px] text-[#55557a]">Fin de l'appel</div>
  </div>
))
HangUpNode.displayName = 'HangUpNode'

// ── Export nodeTypes map ────────────────────────────────
export const nodeTypes = {
  welcome:   WelcomeNode,
  menu:      MenuNode,
  timeCheck: TimeCheckNode,
  transfer:  TransferNode,
  queue:     QueueNode,
  voicemail: VoicemailNode,
  playAudio: PlayAudioNode,
  hangUp:    HangUpNode,
}
