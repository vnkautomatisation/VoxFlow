'use client'
import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './nodes'

interface Props {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onSave: (nodes: Node[], edges: Edge[]) => void
}

const NODE_PALETTE = [
  { type: 'welcome',   label: 'Accueil',       color: '#00d4aa' },
  { type: 'menu',      label: 'Menu DTMF',     color: '#7b61ff' },
  { type: 'timeCheck', label: 'Horaires',       color: '#ffb547' },
  { type: 'transfer',  label: 'Transfert',      color: '#38b6ff' },
  { type: 'queue',     label: 'File attente',   color: '#7b61ff' },
  { type: 'voicemail', label: 'Messagerie',     color: '#ff4d6d' },
  { type: 'playAudio', label: 'Audio',          color: '#00d4aa' },
  { type: 'hangUp',    label: 'Raccrocher',     color: '#ff4d6d' },
]

const DEFAULT_NODES: Node[] = [
  { id: 'start', type: 'welcome', position: { x: 250, y: 50 }, data: { message: 'Bienvenue chez VoxFlow.' } },
]

export default function IVRBuilder({ initialNodes, initialEdges, onSave }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || DEFAULT_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || [])
  const [saved, setSaved] = useState(false)

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#7b61ff' } }, eds))
  }, [setEdges])

  const addNode = useCallback((type: string) => {
    const id = `${type}-${Date.now()}`
    const newNode: Node = {
      id,
      type,
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {},
    }
    setNodes(nds => [...nds, newNode])
  }, [setNodes])

  const handleSave = () => {
    onSave(nodes, edges)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        background: '#111118', borderBottom: '1px solid #2e2e44', flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: '#55557a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 8 }}>
          Ajouter :
        </span>
        {NODE_PALETTE.map(n => (
          <button key={n.type} onClick={() => addNode(n.type)}
            style={{
              padding: '4px 10px', borderRadius: 8, border: `1px solid ${n.color}33`,
              background: `${n.color}12`, color: n.color, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            + {n.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={handleSave}
          style={{
            padding: '6px 16px', borderRadius: 8, background: '#7b61ff', border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
          {saved ? 'Sauvegarde !' : 'Sauvegarder'}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0a0a14' }}
        >
          <Controls showInteractive={false} style={{ background: '#18181f', border: '1px solid #2e2e44', borderRadius: 10 }} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a2e" />
        </ReactFlow>
      </div>
    </div>
  )
}
