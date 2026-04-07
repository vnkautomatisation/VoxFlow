'use client'
import './dialer.css'
import { useEffect, useRef } from 'react'
import { useDialer, fmtT, fmtD, ini, avatarGrad, ACP } from './hooks/useDialer'

// ── SVG Icons ────────────────────────────────────────────────────
const PhoneIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
const HangupIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.19" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
const MuteIcon = () => <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
const HoldIcon = () => <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
const XferIcon = () => <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
const RecIcon = () => <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
const NotesIcon = () => <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
const KpadIcon = () => <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="3" width="3" height="3" rx="1" /><rect x="10" y="3" width="3" height="3" rx="1" /><rect x="16" y="3" width="3" height="3" rx="1" /><rect x="4" y="9" width="3" height="3" rx="1" /><rect x="10" y="9" width="3" height="3" rx="1" /><rect x="16" y="9" width="3" height="3" rx="1" /><rect x="7" y="15" width="9" height="3" rx="1" /></svg>
const BackIcon = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>

export default function DialerPage() {
    const d = useDialer()
    const dtmfDisplayRef = useRef<HTMLDivElement>(null)
    const dtmfOverlayRef = useRef<HTMLDivElement>(null)

    // ── Init Twilio au montage ─────────────────────────────────
    useEffect(() => {
        const loadTwilio = () => {
            if ((window as any).Twilio) return initDevice()
            const s = document.createElement('script')
            s.src = '/twilio.min.js'
            s.onload = initDevice
            document.head.appendChild(s)
        }

        const initDevice = async () => {
            if ((window as any).__VFDevice) return
            if (typeof (window as any).Twilio === 'undefined') return
            if (!d.S.current.tok) return
            try {
                const url = d.S.current.url
                const tok = d.S.current.tok
                let res: any = null
                try { res = await fetch(url + '/api/v1/telephony/voice/token', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json()) } catch { }
                if (!res?.success) try { res = await fetch(url + '/api/v1/telephony/token', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json()) } catch { }
                if (!res?.success || !res?.data?.token) return
                const dev = new (window as any).Twilio.Device(res.data.token, { logLevel: 1, codecPreferences: ['opus', 'pcmu'] })
                dev.on('registered', () => console.log('[VoxFlow] Twilio prêt ✓'))
                dev.on('incoming', d.handleIncoming)
                dev.on('error', (e: any) => d.showToast('Twilio: ' + e.message))
                dev.register()
                    ; (window as any).__VFDevice = dev
            } catch (e: any) { console.warn('[VoxFlow] Twilio init:', e.message) }
        }

        if (d.S.current.tok) loadTwilio()
    }, [d.view])

    // ── Pilule statut appel ────────────────────────────────────
    const callPill = d.onHold
        ? <div className="cpill hold">⏸ En attente</div>
        : d.muted
            ? <div className="cpill muted">🔇 Micro coupé</div>
            : <div className="cpill">En communication</div>

    const vmBadge = d.voicemails.filter(v => v.status === 'NEW').length
    const waiting = d.queue.filter(q => !q.status || q.status === 'waiting')
    const active = d.queue.filter(q => q.status === 'active')

    return (
        <div className="popup" id="popup">

            {/* ── TOAST ── */}
            <div className={`toast ${d.toast ? 'on' : ''}`}>{d.toast}</div>

            {/* ════════ LOGIN ════════ */}
            <div className={`view ${d.view === 'login' ? 'on' : ''}`} id="view-login">
                <div className="hdr" style={{ justifyContent: 'center' }}>
                    <div className="logo"><div className="logo-dot" /><span style={{ color: '#7b61ff' }}>Vox</span><span style={{ color: '#00d4aa' }}>Flow</span></div>
                </div>
                <LoginView err={d.loginErr} onLogin={d.doLogin} />
            </div>

            {/* ════════ INCOMING ════════ */}
            <div className={`view ${d.view === 'incoming' ? 'on' : ''}`} id="view-incoming">
                <div className="hdr">
                    <div className="logo"><div className="logo-dot" style={{ background: 'var(--mint)', boxShadow: '0 0 8px var(--mint)' }} /><span style={{ color: '#7b61ff' }}>Vox</span><span style={{ color: '#00d4aa' }}>Flow</span></div>
                    <div className="rec-ind on" style={{ marginLeft: 'auto' }}><div className="rec-dot" style={{ background: 'var(--mint)' }} />ENTRANT</div>
                </div>
                <div className="inc-wrap">
                    <div className="inc-ring">
                        <div className="cav" style={{ background: d.incoming?.co ? avatarGrad(d.incoming.co.first_name) : 'linear-gradient(135deg,#2d1a80,#3d1fa3)' }}>
                            {d.incoming?.co ? ini(d.incoming.co.first_name + ' ' + d.incoming.co.last_name) : '?'}
                            <div className="cav-ring" />
                        </div>
                        <div className="wave" /><div className="wave w2" /><div className="wave w3" />
                    </div>
                    <div className="inc-lbl">● Appel entrant</div>
                    <div className="cname">{d.incoming?.co ? d.incoming.co.first_name + ' ' + d.incoming.co.last_name : 'Inconnu'}</div>
                    <div className="cco">{d.incoming?.co?.company || ''}</div>
                    <div className="cnum">{d.incoming?.from || ''}</div>
                    <div className="inc-btns">
                        <button className="btn-ref" onClick={d.doRefuse}>✕ Refuser</button>
                        <button className="btn-ans" onClick={d.doAnswer}>✓ Décrocher</button>
                    </div>
                </div>
            </div>

            {/* ════════ IN-CALL ════════ */}
            <div className={`view ${d.view === 'calling' ? 'on' : ''}`} id="view-calling">
                <div className="hdr">
                    <div className="logo"><div className="logo-dot" /><span style={{ color: '#7b61ff' }}>Vox</span><span style={{ color: '#00d4aa' }}>Flow</span></div>
                    <div className={`rec-ind ${d.recording ? 'on' : ''}`}><div className="rec-dot" />REC</div>
                    <div className="hdr-r"><div className="ext-chip">EXT {d.S.current.ext || '201'}</div></div>
                </div>
                <div className="scroll">
                    <div className="ct">
                        <div className="cav" style={{ position: 'relative', background: d.contact ? avatarGrad(d.contact.first_name) : 'linear-gradient(135deg,#2d1a80,#3d1fa3)' }}>
                            <div className="cav-ring" />
                            {d.contact ? ini(d.contact.first_name + ' ' + d.contact.last_name) : '?'}
                        </div>
                        <div className="cname">{d.contact ? d.contact.first_name + ' ' + d.contact.last_name : (d.S.current.dir === 'INBOUND' ? d.incoming?.from : d.dialNum) || '—'}</div>
                        <div className="cco">{d.contact?.company || ''}</div>
                        <div className="cnum">{d.contact ? (d.S.current.dir === 'INBOUND' ? d.incoming?.from : d.dialNum) : ''}</div>
                        <div className="cpill-row">
                            {callPill}
                            <div className={`rec-ind ${d.recording ? 'on' : ''}`}><div className="rec-dot" />REC</div>
                        </div>
                        <div className="ctimer">{fmtT(d.callTimer)}</div>
                    </div>

                    <div className="cbar">
                        <div className="cbar-chip"><svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="11" height="11"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg><div className="qdot" /><span>HD Voice</span></div>
                        <div className="cbar-chip"><svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="11" height="11"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" /></svg><span>WebRTC</span></div>
                        <div className="cbar-chip"><span>{d.S.current.dir === 'INBOUND' ? 'Entrant' : 'Sortant'}</span></div>
                    </div>

                    {/* Waveform */}
                    <div className="wf-wrap" id="wf-wrap">
                        <div className="wf-row"><span className="wf-lbl">Moi</span><canvas className="wf-canvas" id="wf-local" /></div>
                        <div className="wf-row"><span className="wf-lbl">Client</span><canvas className="wf-canvas" id="wf-remote" /></div>
                    </div>

                    {/* Actions */}
                    <div className="cacts">
                        <button className={`abt ${d.muted ? 'm-mute' : ''}`} onClick={d.doMute}><MuteIcon />Muet</button>
                        <button className={`abt ${d.onHold ? 'm-hold' : ''}`} onClick={d.doHold}><HoldIcon />Attente</button>
                        <button className={`abt ${d.panel === 'xfer' ? 'm-panel' : ''}`} onClick={() => d.setPanel(d.panel === 'xfer' ? null : 'xfer')}><XferIcon />Transfert</button>
                        <button className={`abt ${d.recording ? 'm-rec' : ''} ${!d.isAdmin() ? 'locked' : ''}`} onClick={d.doRec}><RecIcon />Enreg.</button>
                        <button className={`abt ${d.panel === 'notes' ? 'm-panel' : ''}`} onClick={() => d.setPanel(d.panel === 'notes' ? null : 'notes')}><NotesIcon />Notes</button>
                        <button className={`abt ${d.panel === 'kpad' ? 'm-panel' : ''}`} onClick={() => {
                            if (dtmfOverlayRef.current) {
                                dtmfOverlayRef.current.classList.add('on')
                                dtmfOverlayRef.current.style.cssText = 'position:absolute;inset:0;z-index:500;border-radius:20px;overflow:hidden'
                            }
                        }}><KpadIcon />Clavier</button>
                    </div>

                    <button className="btn-hup" onClick={d.hangup}><HangupIcon />Raccrocher</button>

                    {/* Panel Transfert */}
                    <div className={`cpanel ${d.panel === 'xfer' ? 'on' : ''}`}>
                        <label>Transférer vers</label>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            {(['blind', 'attended', 'conf'] as const).map(t => (
                                <button key={t} className={`fc ${d.xferType === t ? 'on' : ''}`} onClick={() => d.setXferType(t)}>
                                    {t === 'blind' ? 'Aveugle' : t === 'attended' ? 'Assisté' : 'Conférence'}
                                </button>
                            ))}
                        </div>
                        <div className="prow">
                            <input type="tel" placeholder="+1 514 000-0000 ou poste" value={d.xferNum} onChange={e => d.setXferNum(e.target.value)} />
                            <button className="pbtn" onClick={d.execTransfer}>→ OK</button>
                        </div>
                        {d.qAgentsXfer.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                <div style={{ fontSize: '9px', color: 'var(--tx3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: '6px' }}>Agents disponibles</div>
                                {d.qAgentsXfer.map(a => (
                                    <div key={a.id} className="axfer-row">
                                        <div><span style={{ fontSize: '11px', fontWeight: 600 }}>{a.name || a.first_name + ' ' + a.last_name}</span><span className="aext" style={{ marginLeft: '6px' }}>{a.extension || a.ext || '—'}</span></div>
                                        <button className="btn-take" onClick={() => d.xferToAgent(a.extension || a.ext || '')}>→ Transférer</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Panel Notes */}
                    <div className={`cpanel ${d.panel === 'notes' ? 'on' : ''}`}>
                        <label>Notes d'appel</label>
                        <textarea rows={3} placeholder="Résumé, actions à faire, suivi..." value={d.notesVal} onChange={e => d.setNotesVal(e.target.value)} />
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <select value={d.outcome} onChange={e => d.setOutcome(e.target.value)} style={{ flex: 1, background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 'var(--rs)', color: 'var(--txt)', padding: '7px 9px', fontSize: '11px', fontFamily: 'var(--font)', outline: 'none' }}>
                                <option>Résolu ✓</option><option>Rappel requis 📞</option><option>Escalade ⚠️</option>
                                <option>Opportunité vente 💰</option><option>Support technique 🔧</option><option>Annulation ❌</option>
                            </select>
                            <button className="pbtn mint" onClick={d.saveNotes}>✓ Sauv.</button>
                        </div>
                    </div>

                    {/* Caller Insights */}
                    {d.contact && (
                        <div className="ins">
                            <div className="ins-title"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>Caller Insights</div>
                            {d.contact.email && <div className="ins-row"><span>Email</span><span className="ins-val">{d.contact.email}</span></div>}
                            {d.contact.phone && <div className="ins-row"><span>Téléphone</span><span className="ins-val">{d.contact.phone}</span></div>}
                            {d.contact.company && <div className="ins-row"><span>Entreprise</span><span className="ins-val">{d.contact.company}</span></div>}
                            {d.contact.pipeline_stage && <div className="ins-row"><span>Pipeline</span><span className="ins-val vi">{d.contact.pipeline_stage}</span></div>}
                            {d.contact.total_calls && <div className="ins-row"><span>Appels totaux</span><span className="ins-val mi">{d.contact.total_calls} appels</span></div>}
                            {d.contact.tags?.length ? <div className="ins-row"><span>Tags</span><span className="ins-val">{d.contact.tags.slice(0, 2).join(', ')}</span></div> : null}
                            <button className="btn-crm" onClick={d.openCRM}>Voir la fiche complète →</button>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════ MAIN ════════ */}
            <div className={`view ${d.view === 'main' ? 'on' : ''}`} id="view-main">
                <div className="hdr">
                    <div className="logo"><div className="logo-dot" /><span style={{ color: '#7b61ff' }}>Vox</span><span style={{ color: '#00d4aa' }}>Flow</span></div>
                    <div className="hdr-mid">
                        <div className="ext-chip">EXT {d.S.current.ext || '201'}</div>
                        <div className={`role-badge ${d.isAdmin() ? 'admin' : 'agent'}`}>{d.S.current.role === 'OWNER' ? 'Owner' : d.isAdmin() ? 'Admin' : 'Agent'}</div>
                    </div>
                    <div className="hdr-r">
                        <div className="chip">
                            <div className={`chip-dot ${agStatus2cls(d.agStatus)}`} />
                            <select className="ssel" value={d.agStatus} onChange={e => d.doStatus(e.target.value as any)}>
                                <option value="ONLINE">Disponible</option>
                                <option value="BREAK">Pause</option>
                                <option value="OFFLINE">Hors ligne</option>
                            </select>
                        </div>
                        <button className="ibt" onClick={d.doLogout} title="Déconnexion">
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="tabs">
                    {([
                        ['dialer', 'dialer', 'Dialer', 'phone'],
                        ['queue', 'queue', 'File d\'att.', 'list'],
                        ...(d.isAdmin() ? [['agents', 'agents', 'Agents', 'users']] : []),
                        ['history', 'history', 'Historique', 'clock'],
                        ['voicemails', 'voicemails', 'Msgs', 'voicemail'],
                        ['search', 'search', 'Contacts', 'search'],
                    ] as [string, string, string, string][]).map(([id, , label]) => (
                        <button key={id} className={`tab ${d.tab === id ? 'on' : ''}`} onClick={() => d.setTab(id as any)}>
                            {tabIcon(id)}{label}
                            {id === 'voicemails' && vmBadge > 0 && <span className="tbdg">{vmBadge}</span>}
                            {id === 'queue' && waiting.length > 0 && <span className="tbdg">{waiting.length}</span>}
                        </button>
                    ))}
                </div>

                <div className="scroll">

                    {/* PANE DIALER */}
                    <div className={`pane ${d.tab === 'dialer' ? 'on' : ''}`} id="pane-dialer">
                        <div className="p12">
                            <input className="dinput" id="dinp" value={d.dialNum} placeholder="+1 (514) 000-0000" type="tel"
                                onChange={e => d.setDialNum(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && d.callNum()} />
                            <div className="kpad">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => {
                                    const sub: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '0': '+' }
                                    return (
                                        <button key={k} className={`key ${['*', '#'].includes(k) ? 'sp' : ''}`}
                                            onClick={() => k === '0' ? (!d.lpdoneRef.current && d.setDialNum(p => p + '0')) : d.setDialNum(p => p + k)}
                                            onMouseDown={k === '0' ? (e) => d.startLong() : undefined}
                                            onMouseUp={k === '0' ? () => d.endLong() : undefined}
                                            onMouseLeave={k === '0' ? () => d.endLong() : undefined}>
                                            {k}{sub[k] && <span className="ksub">{sub[k]}</span>}
                                        </button>
                                    )
                                })}
                            </div>
                            <div className="dial-actions">
                                <button className="btn-call" disabled={!d.dialNum} onClick={() => d.callNum()}><PhoneIcon />Appeler</button>
                                {d.dialNum && <button className="btn-del visible" onClick={() => d.setDialNum(p => p.slice(0, -1))}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" /><line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" /></svg>
                                </button>}
                            </div>
                            {/* Récents */}
                            {d.calls.length > 0 && (
                                <div id="recents-wrap">
                                    <div className="slbl" style={{ marginTop: '14px' }}>Récents</div>
                                    {d.calls.slice(0, 3).map(c => {
                                        const name = c.contact ? c.contact.first_name + ' ' + c.contact.last_name : c.direction === 'INBOUND' ? c.from_number : c.to_number
                                        const num = c.direction === 'INBOUND' ? c.from_number : c.to_number
                                        const isMiss = ['NO_ANSWER', 'MISSED'].includes(c.status)
                                        const isIn = c.direction === 'INBOUND'
                                        return (
                                            <div key={c.id} className="ri">
                                                <div className={`ricon ${isMiss ? 'miss' : isIn ? 'in' : 'out'}`}>{isMiss ? '↗' : isIn ? '↓' : '↑'}</div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--tx3)', marginTop: '1px' }}>{fmtD(c.started_at)}{c.duration ? ' · ' + fmtT(c.duration) : ''}</div>
                                                </div>
                                                <button className="bsm" onClick={() => d.callNum(num)}>Rappeler</button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PANE QUEUE */}
                    <div className={`pane ${d.tab === 'queue' ? 'on' : ''}`} id="pane-queue">
                        <div className="p12">
                            <div className="qs-grid">
                                <div className="qs-card"><div className="qs-val" style={{ color: 'var(--violet)' }}>{waiting.length}</div><div className="qs-lbl">En attente</div></div>
                                <div className="qs-card"><div className="qs-val" style={{ color: 'var(--amber)' }}>{fmtT(waiting.length ? Math.round(waiting.reduce((a, q) => a + (q.wait_seconds || 0), 0) / waiting.length) : 0)}</div><div className="qs-lbl">Attente moy.</div></div>
                                <div className="qs-card"><div className="qs-val" style={{ color: 'var(--mint)' }}>{d.queue.filter(q => q.status === 'completed').length}</div><div className="qs-lbl">Traités auj.</div></div>
                            </div>
                            <div className="slbl">Appels en attente</div>
                            {!waiting.length ? <div className="empty">File vide ✓</div> : waiting.map((q, i) => {
                                const w = q.wait_seconds || (i + 1) * 52; const hot = w > 120
                                return (
                                    <div key={q.id} className={`qi ${hot ? 'hot' : ''}`} onClick={() => d.pickQ(q.from_number)}>
                                        <div className={`qi-pos ${i === 0 ? 'r1' : i === 1 ? 'r2' : ''}`}>{i + 1}</div>
                                        <div className="qi-info"><div className="qi-name">{q.caller_name || q.from_number}</div><div className="qi-sub"><span>{q.from_number}</span><span className={`qi-wait ${hot ? 'hot' : ''}`}>{fmtT(w)}</span></div></div>
                                        <button className="btn-take" onClick={e => { e.stopPropagation(); d.pickQ(q.from_number) }}>Prendre</button>
                                    </div>
                                )
                            })}
                            <div className="slbl" style={{ marginTop: '14px' }}>Appels actifs</div>
                            {!active.length ? <div className="empty">Aucun appel actif</div> : active.map(q => (
                                <div key={q.id} className="qi">
                                    <div className="qi-pos" style={{ background: 'var(--mi3)', borderColor: 'rgba(0,212,170,.3)', color: 'var(--mint)' }}>●</div>
                                    <div className="qi-info"><div className="qi-name">{q.caller_name || q.from_number}</div><div className="qi-sub"><span>{q.agent_name || 'Agent'}</span><span className="qi-wait" style={{ color: 'var(--mint)', background: 'var(--mi3)' }}>{fmtT(q.duration || 0)}</span></div></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PANE AGENTS — Admin seulement */}
                    {d.isAdmin() && (
                        <div className={`pane ${d.tab === 'agents' ? 'on' : ''}`} id="pane-agents">
                            <div className="p12">
                                <div className="qs-grid">
                                    <div className="qs-card"><div className="qs-val" style={{ color: 'var(--mint)' }}>{d.agents.filter(a => a.status === 'ONLINE' && !a.current_call).length}</div><div className="qs-lbl">En ligne</div></div>
                                    <div className="qs-card"><div className="qs-val" style={{ color: 'var(--rose)' }}>{d.agents.filter(a => a.current_call).length}</div><div className="qs-lbl">En appel</div></div>
                                    <div className="qs-card"><div className="qs-val" style={{ color: 'var(--amber)' }}>{d.agents.filter(a => a.status === 'BREAK').length}</div><div className="qs-lbl">En pause</div></div>
                                </div>
                                <div className="slbl">Agents connectés</div>
                                {!d.agents.length ? <div className="empty">Aucun agent connecté</div> : d.agents.map((a, i) => {
                                    const st = a.current_call ? 'busy' : (a.status || 'ONLINE').toLowerCase()
                                    const name = a.name || ((a.first_name || '') + ' ' + (a.last_name || ''))
                                    const stL: Record<string, string> = { online: 'Disponible', busy: 'En appel', break: 'En pause', offline: 'Hors ligne' }
                                    return (
                                        <div key={a.id} className="ai">
                                            <div className={`aav ${st}`} style={{ background: `linear-gradient(135deg,${ACP[i % ACP.length][0]},${ACP[i % ACP.length][1]})` }}>
                                                {ini(name)}<div className={`live-dot ${st}`} />
                                            </div>
                                            <div className="ainfo">
                                                <div className="aname">{name}</div>
                                                <div className="asub">
                                                    <span className="aext">{a.extension || a.ext || '—'}</span>
                                                    <span className={`ast ${st}`}>{stL[st] || st}</span>
                                                    {a.call_duration ? <span className="atimer">{fmtT(a.call_duration)}</span> : null}
                                                </div>
                                                {a.current_call_number && <div className="acall-num">↔ {a.current_call_number}</div>}
                                            </div>
                                            {st === 'busy' && (
                                                <div className="sup-btns">
                                                    <button className="btn-sup listen" onClick={() => d.supListen(a.id)}>👂 Écouter</button>
                                                    <button className="btn-sup whisper" onClick={() => d.supWhisper(a.id)}>🗣 Chuchoter</button>
                                                    <button className="btn-sup barge" onClick={() => d.supBarge(a.id)}>⚡ Rejoindre</button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* PANE HISTORY */}
                    <div className={`pane ${d.tab === 'history' ? 'on' : ''}`} id="pane-history">
                        <div className="frow">
                            {(['all', 'INBOUND', 'OUTBOUND', 'MISSED'] as const).map(f => (
                                <button key={f} className={`fc ${d.histFilter === f ? 'on' : ''}`} onClick={() => d.setHistFilter(f)}>
                                    {f === 'all' ? 'Tous' : f === 'INBOUND' ? 'Entrants' : f === 'OUTBOUND' ? 'Sortants' : 'Manqués'}
                                </button>
                            ))}
                        </div>
                        {(() => {
                            let data = d.calls
                            if (d.histFilter === 'INBOUND') data = data.filter(c => c.direction === 'INBOUND')
                            if (d.histFilter === 'OUTBOUND') data = data.filter(c => c.direction === 'OUTBOUND')
                            if (d.histFilter === 'MISSED') data = data.filter(c => ['NO_ANSWER', 'MISSED'].includes(c.status))
                            if (!data.length) return <div className="empty">Aucun appel</div>
                            const tm: Record<string, { c: string, l: string }> = { COMPLETED: { c: 'ok', l: 'Terminé' }, NO_ANSWER: { c: 'miss', l: 'Manqué' }, MISSED: { c: 'miss', l: 'Manqué' }, BUSY: { c: 'busy', l: 'Occupé' }, FAILED: { c: 'miss', l: 'Échec' } }
                            return data.map(c => {
                                const name = c.contact ? c.contact.first_name + ' ' + c.contact.last_name : c.direction === 'INBOUND' ? c.from_number : c.to_number
                                const num = c.direction === 'INBOUND' ? c.from_number : c.to_number
                                const tag = tm[c.status] || { c: 'busy', l: c.status }
                                return (
                                    <div key={c.id} className="hi">
                                        <div className="hico" style={{ color: c.direction === 'INBOUND' ? 'var(--mint)' : 'var(--sky)', background: c.direction === 'INBOUND' ? 'var(--mi3)' : 'var(--sk3)' }}>{c.direction === 'INBOUND' ? '↓' : '↑'}</div>
                                        <div className="hinfo">
                                            <div className="hname">{name}</div>
                                            <div className="hmeta"><span>{fmtD(c.started_at)}</span>{c.duration ? <span className="hdur">{fmtT(c.duration)}</span> : null}<span className={`htag ${tag.c}`}>{tag.l}</span></div>
                                            {c.notes && <div style={{ fontSize: '10px', color: 'var(--tx3)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>"{c.notes}"</div>}
                                        </div>
                                        <div className="hacts">
                                            <button className="bsm" onClick={() => d.callNum(num)}>Rappeler</button>
                                            {c.recording_url && <button className="bsm bl" onClick={() => d.playAudio(c.recording_url!)}>▶ Audio</button>}
                                        </div>
                                    </div>
                                )
                            })
                        })()}
                    </div>

                    {/* PANE VOICEMAILS */}
                    <div className={`pane ${d.tab === 'voicemails' ? 'on' : ''}`} id="pane-voicemails">
                        {!d.voicemails.length ? <div className="empty">Aucun message vocal</div> : d.voicemails.map(v => (
                            <div key={v.id} className="vmi">
                                <div className="vmh">
                                    <div className="vmn">{v.contact ? v.contact.first_name + ' ' + v.contact.last_name : v.from_number}{v.status === 'NEW' && <span className="vmnew">Nouveau</span>}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span className="vmtime">{fmtD(v.created_at)}</span>
                                        {v.recording_url && <button className="btn-play" onClick={() => d.playVM(v.id, v.recording_url!)}>▶</button>}
                                    </div>
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--tx3)', marginBottom: '4px' }}>{v.from_number}{v.duration ? ' · ' + fmtT(v.duration) : ''}</div>
                                {v.transcription && <div className="vmtr">"{v.transcription.substring(0, 160)}{v.transcription.length > 160 ? '…' : ''}"</div>}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                    <button className="bsm" onClick={() => d.callNum(v.from_number)}>Rappeler</button>
                                    <button className="bsm vi" onClick={() => d.markRead(v.id)}>✓ Lu</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* PANE SEARCH */}
                    <div className={`pane ${d.tab === 'search' ? 'on' : ''}`} id="pane-search">
                        <div className="p12">
                            <input className="sinp" placeholder="Nom, téléphone, email, entreprise..." onChange={e => d.doSearch(e.target.value)} />
                            {!d.searchRes.length ? <div className="empty">Tapez pour rechercher</div> : d.searchRes.map((c, i) => (
                                <div key={c.id || i} className="coi">
                                    <div className="coav" style={{ background: `linear-gradient(135deg,${ACP[i % ACP.length][0]},${ACP[i % ACP.length][1]})` }}>{ini((c.first_name || '') + ' ' + (c.last_name || ''))}</div>
                                    <div className="coinf"><div className="coname">{c.first_name} {c.last_name}</div><div className="cosub">{[c.company, c.phone, c.email].filter(Boolean).join(' · ')}</div></div>
                                    {c.phone && <button className="bsm" onClick={() => d.callNum(c.phone!)}>Appeler</button>}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* ════════ WRAP-UP ════════ */}
            <div className={`view ${d.view === 'wrapup' ? 'on' : ''}`} id="view-wrapup">
                <div className="hdr"><div className="logo"><div className="logo-dot" style={{ background: 'var(--mint)', boxShadow: '0 0 8px var(--mint)' }} /><span style={{ color: '#7b61ff' }}>Vox</span><span style={{ color: '#00d4aa' }}>Flow</span></div></div>
                <div className="wu">
                    <svg className="wu-ico" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    <div className="wu-ttl">Appel terminé</div>
                    <div className="wu-dur">Durée : {fmtT(d.wrapupDur)}</div>
                    <div className="wu-sc">
                        <div className="wu-sc-lbl">Évaluation de l'appel</div>
                        <div className="stars">
                            {[1, 2, 3, 4, 5].map(n => <span key={n} onClick={() => { d.setStars(n); d.showToast('★ Évaluation enregistrée') }} style={{ color: n <= d.stars ? 'var(--amber)' : 'var(--tx3)' }}>★</span>)}
                        </div>
                        <div className="wu-tags">
                            {['Résolu', 'Rappel', 'Vente', 'Escalade', 'Support'].map(t => (
                                <button key={t} className="wu-tag" onClick={e => (e.target as HTMLButtonElement).classList.toggle('picked')}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════ DTMF OVERLAY ════════ */}
            <div className="dtmf-overlay" ref={dtmfOverlayRef} id="dtmf-overlay">
                <button className="dtmf-back" onClick={() => dtmfOverlayRef.current?.classList.remove('on')}><BackIcon />Retour</button>
                <div className="dtmf-display" ref={dtmfDisplayRef} id="dtmf-display" />
                <div className="dtmf-grid">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => {
                        const sub: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '0': '+' }
                        return (
                            <button key={k} className="dtmf-key" style={['*', '#'].includes(k) ? { color: 'var(--violet)' } : {}}
                                onClick={() => {
                                    d.dtmf(k)
                                    if (dtmfDisplayRef.current) dtmfDisplayRef.current.textContent += k
                                }}>
                                {k}{sub[k] && <span className="ksub">{sub[k]}</span>}
                            </button>
                        )
                    })}
                </div>
            </div>

        </div>
    )
}

// ── Login View composant ──────────────────────────────────────────
function LoginView({ err, onLogin }: { err: string; onLogin: (url: string, email: string, pass: string) => void }) {
    const urlRef = useRef<HTMLInputElement>(null)
    const emailRef = useRef<HTMLInputElement>(null)
    const passRef = useRef<HTMLInputElement>(null)

    const submit = () => onLogin(
        urlRef.current?.value || 'http://localhost:4000',
        emailRef.current?.value || '',
        passRef.current?.value || '',
    )

    return (
        <div className="login-wrap">
            <div className="lbrand">
                <div className="nm"><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7b61ff', boxShadow: '0 0 12px #7b61ff', marginRight: '10px', flexShrink: 0 }} /><span style={{ color: '#7b61ff' }}>Vox</span><span style={{ color: '#00d4aa' }}>Flow</span></div>
                <div className="sb">Plateforme Call Center Pro</div>
            </div>
            {err && <div className="lerr" style={{ display: 'block' }}>{err}</div>}
            <div className="field"><label>URL Backend</label><input ref={urlRef} defaultValue="http://localhost:4000" /></div>
            <div className="field"><label>Email</label><input ref={emailRef} type="email" placeholder="agent@company.com" /></div>
            <div className="field"><label>Mot de passe</label><input ref={passRef} type="password" placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} /></div>
            <button className="btn-login" onClick={submit}>Se connecter</button>
        </div>
    )
}

// ── Helpers ───────────────────────────────────────────────────────
function agStatus2cls(s: string) {
    if (s === 'ONLINE') return 'on'
    if (s === 'BREAK') return 'pause'
    return 'off'
}

function tabIcon(id: string) {
    const icons: Record<string, JSX.Element> = {
        dialer: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 2px' }}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>,
        queue: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 2px' }}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
        agents: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 2px' }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
        history: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 2px' }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
        voicemails: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 2px' }}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07" /><path d="M2 2l20 20" /></svg>,
        search: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 2px' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    }
    return icons[id] || null
}