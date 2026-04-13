/**
 * IVR Flow Compiler — JSON (react-flow) → TwiML XML
 *
 * Prend le flow_json stocké dans ivr_configs.flow_json et génère
 * le TwiML correspondant pour Twilio.
 *
 * Format flow_json :
 *   { nodes: [{ id, type, data, position }], edges: [{ source, target, sourceHandle }] }
 *
 * Types de noeuds supportés :
 *   welcome   → <Say>
 *   menu      → <Gather> + <Say>
 *   timeCheck → branchement horaire (open/closed)
 *   transfer  → <Dial><Number> ou <Dial><Client>
 *   queue     → <Enqueue>
 *   voicemail → <Say> + <Record>
 *   playAudio → <Play>
 *   hangUp    → <Hangup>
 */

interface FlowNode {
  id:   string
  type: string
  data: Record<string, any>
}

interface FlowEdge {
  source:       string
  target:       string
  sourceHandle?: string
}

interface Flow {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

const BACKEND_URL = () => process.env.BACKEND_URL || "http://localhost:4000"

export function compileFlowToTwiML(flow: Flow, options?: { orgId?: string; ivrId?: string }): string {
  if (!flow?.nodes?.length) {
    return `<?xml version="1.0"?><Response><Say language="fr-CA">Menu non configure.</Say><Hangup/></Response>`
  }

  const nodeMap = new Map<string, FlowNode>()
  flow.nodes.forEach(n => nodeMap.set(n.id, n))

  // Trouver le noeud de départ (welcome ou le premier)
  const startNode = flow.nodes.find(n => n.type === 'welcome') || flow.nodes[0]

  // Construire les successeurs de chaque noeud
  const successors = new Map<string, FlowEdge[]>()
  flow.edges.forEach(e => {
    const list = successors.get(e.source) || []
    list.push(e)
    successors.set(e.source, list)
  })

  let xml = '<?xml version="1.0"?><Response>'
  xml += compileNode(startNode, nodeMap, successors, options, new Set())
  xml += '</Response>'
  return xml
}

function compileNode(
  node: FlowNode,
  nodeMap: Map<string, FlowNode>,
  successors: Map<string, FlowEdge[]>,
  options?: { orgId?: string; ivrId?: string },
  visited?: Set<string>,
): string {
  if (!node) return ''
  if (visited?.has(node.id)) return '' // guard boucle infinie
  visited?.add(node.id)

  const next = successors.get(node.id) || []
  const firstNext = next[0] ? nodeMap.get(next[0].target) : null

  switch (node.type) {
    case 'welcome':
      return `<Say language="fr-CA">${esc(node.data.message || 'Bienvenue.')}</Say>`
        + (firstNext ? compileNode(firstNext, nodeMap, successors, options, visited) : '')

    case 'menu': {
      const gatherUrl = `${BACKEND_URL()}/api/v1/telephony/twiml/ivr/${options?.ivrId || 'default'}/gather?orgId=${options?.orgId || ''}`
      return `<Gather numDigits="1" action="${gatherUrl}" timeout="5">`
        + `<Say language="fr-CA">${esc(node.data.prompt || 'Faites votre choix.')}</Say>`
        + `</Gather>`
        + `<Say language="fr-CA">Nous n'avons pas compris. Au revoir.</Say><Hangup/>`
    }

    case 'timeCheck': {
      // En TwiML statique on ne peut pas faire de branchement horaire.
      // On redirige vers un endpoint dynamique qui vérifie l'heure.
      const url = `${BACKEND_URL()}/api/v1/telephony/twiml/ivr/${options?.ivrId || 'default'}?orgId=${options?.orgId || ''}&check=time`
      return `<Redirect>${url}</Redirect>`
    }

    case 'transfer':
      return `<Dial timeout="25">${
        (node.data.target || '').startsWith('+')
          ? `<Number>${esc(node.data.target)}</Number>`
          : `<Client>${esc(node.data.target || 'agent')}</Client>`
      }</Dial>`

    case 'queue':
      return `<Enqueue waitUrl="${BACKEND_URL()}/api/v1/telephony/twiml/hold-music">${esc(node.data.queueId || 'default')}</Enqueue>`

    case 'voicemail':
      return `<Say language="fr-CA">${esc(node.data.message || 'Laissez un message.')}</Say>`
        + `<Record maxLength="120" playBeep="true" recordingStatusCallback="${BACKEND_URL()}/api/v1/telephony/webhook/voicemail?orgId=${options?.orgId || ''}"/>`

    case 'playAudio':
      return `<Play>${esc(node.data.audioUrl || '')}</Play>`
        + (firstNext ? compileNode(firstNext, nodeMap, successors, options, visited) : '')

    case 'hangUp':
      return '<Hangup/>'

    default:
      return ''
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
