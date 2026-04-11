/**
 * Non-intrusive global bag for Twilio SDK + WebRTC state that must
 * persist across React renders without triggering re-renders.
 *
 * Kept on `window` because the Twilio SDK attaches listeners to
 * specific Device/Call objects that we need to reach from multiple
 * hooks, and stale closures would break the event flow.
 *
 * This wrapper replaces the 12+ `(window as any).__VF*` casts in
 * useDialer.ts with a typed accessor while avoiding module augmentation
 * on the global `Window` interface.
 */

type VFGlobals = {
  device?:        any         // Twilio.Device instance
  call?:          any         // Twilio.Call instance
  wfLocalStream?: MediaStream // local mic stream for waveform viz
}

const KEY = '__VF_GLOBALS__'

function bag(): VFGlobals {
  if (typeof window === 'undefined') return {}
  const w = window as any
  if (!w[KEY]) w[KEY] = {}
  return w[KEY] as VFGlobals
}

export const vfGlobals = {
  getDevice:        () => bag().device,
  setDevice:        (d: any) => { bag().device = d },
  getCall:          () => bag().call,
  setCall:          (c: any) => { bag().call = c },
  clearCall:        () => { delete bag().call },
  getWfLocalStream: () => bag().wfLocalStream,
  setWfLocalStream: (s: MediaStream | undefined) => {
    if (s) bag().wfLocalStream = s
    else delete bag().wfLocalStream
  },
}
