/**
 * Open a floating modal inside `.popup` with an audio player for a
 * remote recording URL. Handles Twilio recording URLs that need auth
 * token via backend proxy.
 *
 * Extracted from useDialer.ts to reduce hook size. Pure DOM utility,
 * no React state.
 */

interface PlayAudioOptions {
  /** Full URL of the recording file */
  url:       string
  /** Backend base URL (e.g. http://localhost:4000) for the recording proxy */
  apiUrl:    string
  /** Bearer token for the proxy request (required for Twilio URLs) */
  token?:    string
}

const MODAL_ID = 'vf-audio-modal'

export function playAudioFile({ url, apiUrl, token }: PlayAudioOptions): void {
  if (!url) return

  const proxyUrl = url.includes('twilio.com') && token
    ? apiUrl + '/api/v1/telephony/recording-proxy?url=' + encodeURIComponent(url)
    : url

  // Remove any existing modal first (avoids stacking)
  document.getElementById(MODAL_ID)?.remove()

  const modal = document.createElement('div')
  modal.id = MODAL_ID
  modal.style.cssText =
    'position:absolute;inset:0;background:rgba(0,0,0,.82);' +
    'z-index:9999;display:flex;align-items:center;justify-content:center;' +
    'border-radius:20px'
  modal.innerHTML = `
    <div style="background:#18181f;border:1px solid #3a3a55;border-radius:16px;padding:20px;width:300px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#55557a;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Enregistrement
      </div>
      <div id="vf-audio-status" style="font-size:12px;color:#9898b8;text-align:center;padding:8px 0">Chargement...</div>
      <audio id="vf-audio-el" controls style="width:100%;border-radius:8px;display:none"></audio>
      <button id="vf-audio-close" style="margin-top:12px;width:100%;background:#1f1f2a;border:1px solid #2e2e44;border-radius:8px;color:#9898b8;padding:8px;font-size:12px;cursor:pointer;font-family:var(--font)">Fermer</button>
    </div>`

  document.getElementById('popup')?.appendChild(modal)

  // Wire close button (no inline onclick — cleaner CSP)
  modal.querySelector<HTMLButtonElement>('#vf-audio-close')?.addEventListener('click', () => {
    modal.remove()
  })

  const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {}
  fetch(proxyUrl, { headers })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.blob()
    })
    .then(blob => {
      const audio  = modal.querySelector<HTMLAudioElement>('#vf-audio-el')
      const status = modal.querySelector<HTMLDivElement>('#vf-audio-status')
      if (!audio || !status) return
      audio.src = URL.createObjectURL(blob)
      audio.style.display = 'block'
      status.style.display = 'none'
      audio.play().catch(() => { /* autoplay policy — user can click */ })
    })
    .catch(e => {
      const status = modal.querySelector<HTMLDivElement>('#vf-audio-status')
      if (status) {
        status.textContent = 'Erreur: ' + (e as Error).message
        status.style.color = '#ff4d6d'
      }
    })
}
