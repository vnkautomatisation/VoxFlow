// VoxFlow Extension Chrome — Popup complet

const store = {
  get: k => new Promise(r => chrome.storage.local.get(k, r)),
  set: o => new Promise(r => chrome.storage.local.set(o, r)),
  del: k => new Promise(r => chrome.storage.local.remove(k, r)),
}

let S = {
  view:        'login',
  token:       null,
  apiUrl:      'http://localhost:4000',
  tab:         'dialer',
  dialNumber:  '',
  agentStatus: 'ONLINE',
  activeCall:  null,
  contact:     null,
  calls:       [],
  voicemails:  [],
  searchQ:     '',
  searchRes:   [],
  isMuted:     false,
  isOnHold:    false,
  callTimer:   0,
  timerInt:    null,
  notesOpen:   false,
  xferOpen:    false,
}

// ── API ──────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(S.apiUrl + path, {
    mode:        'cors',
    credentials: 'omit',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Erreur ' + res.status)
  }
  return res.json()
}

// ── Timer ────────────────────────────────────────────────────
function startTimer() {
  S.callTimer = 0
  S.timerInt = setInterval(() => {
    S.callTimer++
    const el = document.getElementById('timer')
    if (el) el.textContent = fmtTimer(S.callTimer)
  }, 1000)
}

function stopTimer() {
  clearInterval(S.timerInt)
  S.timerInt = null
}

function fmtTimer(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

function fmtDate(dt) {
  if (!dt) return ''
  const d = new Date(dt), now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60)    return 'A l instant'
  if (diff < 3600)  return Math.floor(diff / 60) + 'min'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' })
}

// ── Status colors ────────────────────────────────────────────
function statusColor(s) {
  return s === 'ONLINE' ? '#4ade80' : s === 'BREAK' ? '#fbbf24' : '#6b7280'
}
function statusLabel(s) {
  return s === 'ONLINE' ? 'Disponible' : s === 'BREAK' ? 'Pause' : 'Hors ligne'
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const stored = await store.get(['voxflow_token', 'voxflow_api_url', 'voxflow_dial_number'])
  if (stored.voxflow_api_url) S.apiUrl = stored.voxflow_api_url
  if (stored.voxflow_token)   S.token  = stored.voxflow_token

  if (stored.voxflow_dial_number) {
    S.dialNumber = stored.voxflow_dial_number
    await store.del('voxflow_dial_number')
  }

  if (S.token) {
    S.view = 'main'
    chrome.runtime.sendMessage({ type: 'START_POLLING' })
    await loadData()
  }

  render()
}

async function loadData() {
  try {
    const [cr, vr] = await Promise.all([
      api('/api/v1/telephony/calls?limit=20'),
      api('/api/v1/telephony/voicemails'),
    ])
    if (cr.success) S.calls = cr.data || []
    if (vr.success) S.voicemails = vr.data || []
  } catch {}
}

// ── Actions ──────────────────────────────────────────────────
async function login() {
  const email = document.getElementById('inp-email')?.value
  const pass  = document.getElementById('inp-pass')?.value
  const url   = document.getElementById('inp-url')?.value || S.apiUrl

  S.apiUrl = url.replace(/\/$/, '')
  await store.set({ voxflow_api_url: S.apiUrl })

  try {
    const res = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: pass } })
    if (res.success && res.data?.accessToken) {
      S.token = res.data.accessToken
      await store.set({ voxflow_token: S.token })
      S.view = 'main'
      chrome.runtime.sendMessage({ type: 'START_POLLING' })
      await loadData()
      render()
    } else {
      showError(res.message || 'Identifiants incorrects')
    }
  } catch (e) {
    showError(e.message || 'Erreur de connexion — verifiez l URL backend')
  }
}

async function logout() {
  await store.del(['voxflow_token'])
  S.token = null
  S.view = 'login'
  chrome.runtime.sendMessage({ type: 'STOP_POLLING' })
  render()
}

async function makeCall() {
  if (!S.dialNumber.trim()) return
  const to = S.dialNumber.trim()

  try {
    const res = await api('/api/v1/telephony/call/outbound', { method: 'POST', body: { to } })
    if (res.success) {
      S.activeCall = res.data.call
      S.contact    = res.data.contact
      S.view = 'calling'
      S.isMuted = false
      S.isOnHold = false
      startTimer()
      render()
    } else {
      showError(res.message || 'Erreur appel')
    }
  } catch (e) {
    showError(e.message)
  }
}

async function hangup() {
  stopTimer()
  if (S.activeCall?.id) {
    try {
      await api('/api/v1/telephony/call/' + S.activeCall.id + '/end', {
        method: 'PATCH', body: { duration: S.callTimer }
      })
    } catch {}
  }
  const notes = document.getElementById('notes-input')?.value
  if (notes && S.activeCall?.id) {
    try { await api('/api/v1/telephony/call/' + S.activeCall.id + '/notes', { method: 'PATCH', body: { notes } }) } catch {}
  }
  S.activeCall = null
  S.contact = null
  S.view = 'main'
  S.tab = 'dialer'
  S.notesOpen = false
  S.xferOpen = false
  S.dialNumber = ''
  await loadData()
  render()
}

async function toggleMute() {
  S.isMuted = !S.isMuted
  if (S.activeCall?.id) {
    try { await api('/api/v1/telephony/call/' + S.activeCall.id + '/mute', { method: 'PATCH', body: { mute: S.isMuted } }) } catch {}
  }
  document.getElementById('btn-mute')?.classList.toggle('active-mute', S.isMuted)
}

async function toggleHold() {
  S.isOnHold = !S.isOnHold
  if (S.activeCall?.id) {
    try { await api('/api/v1/telephony/call/' + S.activeCall.id + '/hold', { method: 'PATCH', body: { hold: S.isOnHold } }) } catch {}
  }
  document.getElementById('btn-hold')?.classList.toggle('active-hold', S.isOnHold)
}

async function transferCall() {
  const to = document.getElementById('xfer-input')?.value
  if (!to || !S.activeCall?.id) return
  try {
    await api('/api/v1/telephony/call/' + S.activeCall.id + '/transfer', {
      method: 'POST', body: { to, type: 'blind' }
    })
    hangup()
  } catch (e) { showError(e.message) }
}

async function setStatus(status) {
  S.agentStatus = status
  try { await api('/api/v1/telephony/status', { method: 'PATCH', body: { status } }) } catch {}
}

async function searchContacts(q) {
  if (!q || q.length < 2) { S.searchRes = []; renderTabContent(); return }
  try {
    const res = await api('/api/v1/crm/contacts?search=' + encodeURIComponent(q) + '&limit=6')
    if (res.success) S.searchRes = res.data || []
    renderTabContent()
  } catch {}
}

function showError(msg) {
  const el = document.getElementById('error-bar')
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
  setTimeout(() => { if (el) el.style.display = 'none' }, 4000)
}

function dialKey(k) {
  if (k === '⌫') {
    S.dialNumber = S.dialNumber.slice(0, -1)
  } else {
    S.dialNumber += k
  }
  const inp = document.getElementById('dial-input')
  if (inp) inp.value = S.dialNumber
}

// ── Render ───────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app')
  if (!app) return

  if (S.view === 'login') {
    app.innerHTML = renderLogin()
    bindLogin()
    return
  }

  if (S.view === 'incoming') {
    app.innerHTML = renderHeader() + renderIncoming()
    bindIncoming()
    return
  }

  if (S.view === 'calling') {
    app.innerHTML = renderHeader() + renderCalling()
    bindCalling()
    return
  }

  // Main
  app.innerHTML = renderHeader() + renderTabs() + '<div class="content" id="tab-content"></div>'
  renderTabContent()
  bindMain()
}

function renderHeader() {
  return `
    <div class="header">
      <span class="logo">VoxFlow</span>
      <div class="header-right">
        <select class="status-sel" id="status-sel" onchange="setStatus(this.value); updateStatusDot()">
          <option value="ONLINE"  ${S.agentStatus==='ONLINE' ?'selected':''}>● Disponible</option>
          <option value="BREAK"   ${S.agentStatus==='BREAK'  ?'selected':''}>● Pause</option>
          <option value="OFFLINE" ${S.agentStatus==='OFFLINE'?'selected':''}>● Hors ligne</option>
        </select>
        ${S.view !== 'login' ? `<button class="btn-logout" id="btn-logout" title="Deconnexion">⏻</button>` : ''}
      </div>
    </div>
  `
}

function renderTabs() {
  const vmNew = S.voicemails.filter(v => v.status === 'NEW').length
  const tabs = [
    { id: 'dialer',     label: 'Dialer'     },
    { id: 'history',    label: 'Historique' },
    { id: 'voicemails', label: 'Messages', badge: vmNew },
    { id: 'search',     label: 'Recherche'  },
  ]
  return `
    <div class="tabs" id="tabs">
      ${tabs.map(t => `
        <button class="tab ${S.tab===t.id?'active':''}" data-tab="${t.id}">
          ${t.label}
          ${t.badge ? `<span class="tab-badge">${t.badge}</span>` : ''}
        </button>
      `).join('')}
    </div>
  `
}

function renderTabContent() {
  const el = document.getElementById('tab-content')
  if (!el) return
  el.innerHTML =
    S.tab === 'dialer'     ? renderDialer()     :
    S.tab === 'history'    ? renderHistory()    :
    S.tab === 'voicemails' ? renderVoicemails() :
    renderSearch()
  bindTabContent()
}

function renderLogin() {
  return `
    <div class="login-wrap">
      <div class="login-title">
        <div class="brand">VoxFlow</div>
        <div class="sub">Plateforme SaaS Call Center</div>
      </div>
      <div class="error-bar" id="error-bar"></div>
      <div class="field">
        <label>URL Backend</label>
        <input id="inp-url" value="${S.apiUrl}" placeholder="http://localhost:4000"/>
      </div>
      <div class="field">
        <label>Email</label>
        <input id="inp-email" type="email" placeholder="admin@test.com"/>
      </div>
      <div class="field">
        <label>Mot de passe</label>
        <input id="inp-pass" type="password" placeholder="••••••••"/>
      </div>
      <button class="btn-primary" id="btn-login">Se connecter</button>
    </div>
  `
}

function renderIncoming() {
  const c = S.contact
  const initials = c ? (c.first_name[0] + c.last_name[0]).toUpperCase() : '?'
  return `
    <div class="incoming-wrap">
      <div class="incoming-pulse">Appel entrant...</div>
      <div class="avatar" style="margin: 0 auto 12px">${initials}</div>
      <div class="caller-name">${c ? c.first_name + ' ' + c.last_name : S.activeCall?.from_number || 'Inconnu'}</div>
      ${c?.company ? `<div class="caller-company">${c.company}</div>` : ''}
      <div style="color:#9ca3af;font-size:13px;margin-top:4px">${S.activeCall?.from_number || ''}</div>
      <div class="incoming-btns">
        <button class="btn-refuse" id="btn-refuse">✕ Refuser</button>
        <button class="btn-answer" id="btn-answer">✓ Decrocher</button>
      </div>
    </div>
  `
}

function renderCalling() {
  const c = S.contact
  const initials = c ? (c.first_name[0] + c.last_name[0]).toUpperCase() : (S.dialNumber[0] || '?')
  return `
    <div class="incall-wrap">
      <div class="incall-contact">
        <div class="avatar">${initials}</div>
        <div class="caller-name">${c ? c.first_name + ' ' + c.last_name : S.dialNumber}</div>
        ${c?.company ? `<div class="caller-company">${c.company}</div>` : ''}
        <div class="call-status" id="call-status">En communication</div>
        <div class="call-timer" id="timer">${fmtTimer(S.callTimer)}</div>
      </div>

      <div class="call-actions">
        <button class="call-btn ${S.isMuted?'active-mute':''}" id="btn-mute">
          ${iconMic()} Muet
        </button>
        <button class="call-btn ${S.isOnHold?'active-hold':''}" id="btn-hold">
          ${iconPause()} Attente
        </button>
        <button class="call-btn" id="btn-xfer-toggle">
          ${iconTransfer()} Transferer
        </button>
        <button class="call-btn" id="btn-keypad">
          ${iconKeypad()} Clavier
        </button>
        <button class="call-btn" id="btn-notes-toggle">
          ${iconNotes()} Notes
        </button>
        <button class="call-btn" id="btn-conf">
          ${iconConf()} Conference
        </button>
      </div>

      <button class="btn-hangup" id="btn-hangup">
        ${iconPhoneOff()} Raccrocher
      </button>

      <!-- Transfer panel -->
      <div class="transfer-panel ${S.xferOpen?'open':''}" id="xfer-panel">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Transferer vers</div>
        <input id="xfer-input" placeholder="+1 514 000-0000" type="tel"/>
        <div style="display:flex;gap:6px">
          <button class="btn-primary" style="padding:6px;font-size:12px" id="btn-xfer-go">Transferer</button>
        </div>
      </div>

      <!-- Notes panel -->
      <div class="notes-panel ${S.notesOpen?'open':''}" id="notes-panel">
        <div style="font-size:11px;color:#6b7280">Notes de l appel</div>
        <textarea id="notes-input" rows="3" placeholder="Vos notes..."></textarea>
        <button style="background:#7c3aed;border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer" id="btn-save-notes">
          Sauvegarder
        </button>
      </div>

      <!-- Caller Insights -->
      ${c ? renderInsights(c) : ''}
    </div>
  `
}

function renderInsights(c) {
  return `
    <div class="insights">
      <div class="insights-title">
        ${iconUser()} Caller Insights
      </div>
      ${c.email    ? insightRow('Email', c.email) : ''}
      ${c.phone    ? insightRow('Tel', c.phone) : ''}
      ${c.company  ? insightRow('Entreprise', c.company) : ''}
      ${c.pipeline_stage ? insightRow('Pipeline', c.pipeline_stage, 'purple') : ''}
      ${c.tags?.length   ? insightRow('Tags', c.tags.join(', ')) : ''}
      <button class="btn-view-full" id="btn-open-crm">Voir la fiche complete →</button>
    </div>
  `
}

function insightRow(label, val, cls = '') {
  return `
    <div class="insight-row">
      <span>${label}</span>
      <span class="insight-val ${cls}">${val}</span>
    </div>
  `
}

function renderDialer() {
  const recents = S.calls.slice(0, 3)
  return `
    <input class="dial-input" id="dial-input" value="${S.dialNumber}" placeholder="+1 (514) 000-0000" type="tel"/>

    <div class="keypad">
      ${[
        ['+',''], ['1',''], ['2','ABC'], ['3','DEF'],
        ['4','GHI'], ['5','JKL'], ['6','MNO'],
        ['7','PQRS'], ['8','TUV'], ['9','WXYZ'],
        ['*',''], ['0','+'], ['#',''], ['⌫','']
      ].map(([k, s]) => `
        <button class="key ${k==='+'||k==='⌫'?'special':''}" data-key="${k}">
          ${k}<span class="sub-label">${s}</span>
        </button>
      `).join('')}
    </div>

    <button class="btn-call" id="btn-call" ${!S.dialNumber?'disabled':''}>
      ${iconPhone()} Appeler
    </button>

    ${recents.length > 0 ? `
      <div class="section-label">Recents</div>
      ${recents.map(c => {
        const name = c.contact ? c.contact.first_name + ' ' + c.contact.last_name
                   : c.direction === 'INBOUND' ? c.from_number : c.to_number
        const num  = c.direction === 'INBOUND' ? c.from_number : c.to_number
        const dir  = c.direction === 'INBOUND' ? '↓' : '↑'
        const col  = c.status === 'COMPLETED' ? '#4ade80' : c.status === 'NO_ANSWER' ? '#ef4444' : '#fbbf24'
        return `
          <div class="recent-item">
            <div>
              <div class="recent-name">${name}</div>
              <div class="recent-meta" style="color:${col}">${dir} ${c.direction==='INBOUND'?'Entrant':'Sortant'} · ${fmtDate(c.started_at)}</div>
            </div>
            <button class="btn-sm" data-recall="${num}">Rappeler</button>
          </div>
        `
      }).join('')}
    ` : ''}
  `
}

function renderHistory() {
  if (!S.calls.length) return '<div class="empty-state">Aucun appel</div>'
  return S.calls.map(c => {
    const name = c.contact ? c.contact.first_name + ' ' + c.contact.last_name
               : c.direction === 'INBOUND' ? c.from_number : c.to_number
    const num  = c.direction === 'INBOUND' ? c.from_number : c.to_number
    const icon = c.direction === 'INBOUND' ? '↓' : '↑'
    const col  = c.status==='COMPLETED'?'#4ade80':c.status==='NO_ANSWER'?'#ef4444':'#fbbf24'
    return `
      <div class="hist-item">
        <div class="hist-icon" style="color:${col}">${icon}</div>
        <div class="hist-info">
          <div class="hist-name">${name}</div>
          <div class="hist-meta">${fmtDate(c.started_at)}${c.duration?' · '+fmtTimer(c.duration):''}</div>
          ${c.notes ? `<div class="hist-notes">"${c.notes}"</div>` : ''}
        </div>
        <div class="hist-actions">
          <button class="btn-sm" data-recall="${num}">Rappeler</button>
          ${c.recording_url ? `<button class="btn-sm blue" data-audio="${c.recording_url}">Ecouter</button>` : ''}
        </div>
      </div>
    `
  }).join('')
}

function renderVoicemails() {
  if (!S.voicemails.length) return '<div class="empty-state">Aucun message vocal</div>'
  return S.voicemails.map(vm => `
    <div class="vm-item">
      <div class="vm-header">
        <div class="vm-name">
          ${vm.contact ? vm.contact.first_name + ' ' + vm.contact.last_name : vm.from_number}
          ${vm.status === 'NEW' ? '<span class="vm-new">Nouveau</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="vm-time">${fmtDate(vm.created_at)}</div>
          ${vm.recording_url ? `<button class="btn-play" data-vm-id="${vm.id}" data-vm-url="${vm.recording_url}">▶ Ecouter</button>` : ''}
        </div>
      </div>
      ${vm.transcription ? `<div class="vm-transcript">"${vm.transcription.substring(0,120)}${vm.transcription.length>120?'...':''}"</div>` : ''}
    </div>
  `).join('')
}

function renderSearch() {
  return `
    <input class="search-input" id="search-input" placeholder="Rechercher un contact..." value="${S.searchQ}"/>
    <div id="search-results">
      ${S.searchQ.length < 2
        ? '<div class="empty-state">Tapez pour rechercher</div>'
        : S.searchRes.length === 0
        ? '<div class="empty-state">Aucun resultat</div>'
        : S.searchRes.map(c => `
          <div class="contact-item">
            <div>
              <div class="contact-name">${c.first_name} ${c.last_name}</div>
              ${c.company ? `<div class="contact-sub">${c.company}</div>` : ''}
              ${c.phone   ? `<div class="contact-sub">${c.phone}</div>` : ''}
            </div>
            ${c.phone ? `<button class="btn-sm" data-call-contact="${c.phone}">Appeler</button>` : ''}
          </div>
        `).join('')
      }
    </div>
  `
}

// ── Bind ─────────────────────────────────────────────────────
function bindLogin() {
  document.getElementById('btn-login')?.addEventListener('click', login)
  document.getElementById('inp-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') login() })
}

function bindIncoming() {
  document.getElementById('btn-answer')?.addEventListener('click', () => {
    S.view = 'calling'
    startTimer()
    render()
  })
  document.getElementById('btn-refuse')?.addEventListener('click', hangup)
  bindHeader()
}

function bindCalling() {
  document.getElementById('btn-hangup')?.addEventListener('click', hangup)
  document.getElementById('btn-mute')?.addEventListener('click', toggleMute)
  document.getElementById('btn-hold')?.addEventListener('click', toggleHold)
  document.getElementById('btn-xfer-toggle')?.addEventListener('click', () => {
    S.xferOpen = !S.xferOpen
    document.getElementById('xfer-panel')?.classList.toggle('open', S.xferOpen)
  })
  document.getElementById('btn-notes-toggle')?.addEventListener('click', () => {
    S.notesOpen = !S.notesOpen
    document.getElementById('notes-panel')?.classList.toggle('open', S.notesOpen)
  })
  document.getElementById('btn-xfer-go')?.addEventListener('click', transferCall)
  document.getElementById('btn-save-notes')?.addEventListener('click', async () => {
    const notes = document.getElementById('notes-input')?.value
    if (notes && S.activeCall?.id) {
      try { await api('/api/v1/telephony/call/' + S.activeCall.id + '/notes', { method: 'PATCH', body: { notes } }) } catch {}
    }
  })
  document.getElementById('btn-open-crm')?.addEventListener('click', () => {
    chrome.tabs.create({ url: S.apiUrl.replace(':4000', ':3001') + '/admin/crm' })
  })
  bindHeader()
}

function bindMain() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.tab = btn.dataset.tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      renderTabContent()
    })
  })
  bindHeader()
}

function bindTabContent() {
  // Dialer input
  document.getElementById('dial-input')?.addEventListener('input', e => {
    S.dialNumber = e.target.value
    const btn = document.getElementById('btn-call')
    if (btn) btn.disabled = !S.dialNumber.trim()
  })

  // Keypad
  document.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      dialKey(btn.dataset.key)
      const btn2 = document.getElementById('btn-call')
      if (btn2) btn2.disabled = !S.dialNumber.trim()
    })
  })

  // Call
  document.getElementById('btn-call')?.addEventListener('click', makeCall)

  // Recall
  document.querySelectorAll('[data-recall]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.dialNumber = btn.dataset.recall
      S.tab = 'dialer'
      renderTabContent()
      setTimeout(makeCall, 100)
    })
  })

  // Call contact
  document.querySelectorAll('[data-call-contact]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.dialNumber = btn.dataset.callContact
      S.tab = 'dialer'
      renderTabContent()
      setTimeout(makeCall, 100)
    })
  })

  // Audio
  document.querySelectorAll('[data-audio]').forEach(btn => {
    btn.addEventListener('click', () => new Audio(btn.dataset.audio).play().catch(() => {}))
  })

  // Voicemail play
  document.querySelectorAll('[data-vm-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = btn.dataset.vmId
      const url = btn.dataset.vmUrl
      S.voicemails = S.voicemails.map(v => v.id === id ? { ...v, status: 'LISTENED' } : v)
      try { await api('/api/v1/telephony/voicemail/' + id + '/listen', { method: 'PATCH' }) } catch {}
      new Audio(url).play().catch(() => {})
      btn.textContent = '▶ En lecture'
    })
  })

  // Search
  document.getElementById('search-input')?.addEventListener('input', e => {
    S.searchQ = e.target.value
    searchContacts(S.searchQ)
  })
}

function bindHeader() {
  document.getElementById('btn-logout')?.addEventListener('click', logout)
  document.getElementById('status-sel')?.addEventListener('change', e => setStatus(e.target.value))
}

// ── Icons SVG inline ─────────────────────────────────────────
const ic = (d, w=16, h=16) => `<svg width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${d}</svg>`
const iconPhone    = () => ic('<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>')
const iconPhoneOff = () => ic('<path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.19"/><line x1="23" y1="1" x2="1" y2="23"/>')
const iconMic      = () => ic('<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>')
const iconPause    = () => ic('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>')
const iconTransfer = () => ic('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>')
const iconKeypad   = () => ic('<rect x="5" y="3" width="3" height="3" rx="1"/><rect x="10.5" y="3" width="3" height="3" rx="1"/><rect x="16" y="3" width="3" height="3" rx="1"/><rect x="5" y="8.5" width="3" height="3" rx="1"/><rect x="10.5" y="8.5" width="3" height="3" rx="1"/><rect x="16" y="8.5" width="3" height="3" rx="1"/><rect x="8" y="14" width="8" height="3" rx="1"/>')
const iconNotes    = () => ic('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>')
const iconConf     = () => ic('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>')
const iconUser     = () => ic('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>')

// ── Start ────────────────────────────────────────────────────
init()
