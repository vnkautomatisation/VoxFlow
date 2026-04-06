// ── À ajouter dans lib/authApi.ts après un login réussi ──────────────────────
// Ou dans le layout agent au mount

export async function syncDialerStorage(apiUrl: string, token: string) {
  try {
    const res = await fetch(apiUrl + '/api/v1/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    })
    if (!res.ok) return
    const { data: u } = await res.json()
    if (!u) return
    if (u.role)      localStorage.setItem('vf_role', u.role)
    if (u.extension) localStorage.setItem('vf_ext',  u.extension)
    if (u.plan)      localStorage.setItem('vf_plan', u.plan)
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || ''
    if (name) localStorage.setItem('vf_name', name)
  } catch {}
}
