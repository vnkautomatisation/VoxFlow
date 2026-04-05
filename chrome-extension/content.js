// VoxFlow Content Script — Click-to-call sur toutes les pages

const PHONE_REGEX = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g

let injected = false

function injectClickToCall() {
  if (injected) return
  injected = true

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        if (['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(parent.tagName))
          return NodeFilter.FILTER_REJECT
        if (parent.dataset.voxflowProcessed) return NodeFilter.FILTER_REJECT
        if (PHONE_REGEX.test(node.textContent)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_REJECT
      }
    }
  )

  const nodes = []
  let node
  while ((node = walker.nextNode())) nodes.push(node)

  nodes.forEach(textNode => {
    const parent = textNode.parentElement
    if (!parent || parent.dataset.voxflowProcessed) return
    parent.dataset.voxflowProcessed = 'true'

    PHONE_REGEX.lastIndex = 0
    const html = textNode.textContent.replace(PHONE_REGEX, (match) => {
      const clean = match.replace(/\D/g, '')
      const e164  = clean.length === 10 ? '+1' + clean : '+' + clean
      return `<span class="voxflow-phone" data-number="${e164}" title="Appeler avec VoxFlow">${match}</span>`
    })

    const span = document.createElement('span')
    span.innerHTML = html
    parent.replaceChild(span, textNode)
  })

  // Click handler
  document.addEventListener('click', e => {
    const el = e.target.closest('.voxflow-phone')
    if (!el) return
    e.preventDefault()
    e.stopPropagation()

    const number = el.dataset.number
    chrome.runtime.sendMessage({ type: 'CLICK_TO_CALL', number })

    // Feedback visuel
    el.style.background = '#16a34a44'
    setTimeout(() => { el.style.background = '' }, 1000)
  })
}

// Lancer apres chargement
if (document.readyState === 'complete') {
  injectClickToCall()
} else {
  window.addEventListener('load', injectClickToCall)
}

// MutationObserver pour les SPA
const observer = new MutationObserver(() => {
  document.querySelectorAll('[data-voxflow-processed]').forEach(el => {
    delete el.dataset.voxflowProcessed
  })
  injected = false
  setTimeout(injectClickToCall, 500)
})

observer.observe(document.body, { childList: true, subtree: true })
