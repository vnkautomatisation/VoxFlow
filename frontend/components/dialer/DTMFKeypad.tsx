'use client'

/**
 * Shared DTMF keypad (0-9, *, #) used both in the composer tab and
 * during an active call as a floating overlay. Extracted from
 * page.tsx to remove duplication.
 *
 * The `0` key supports long-press to insert `+` (international format).
 * Caller owns the long-press timer state via onLongPress/onLongRelease.
 *
 * Two visual variants :
 *   - default : small `.kpad` / `.key` from the composer tab
 *   - compact : `.dtmf-grid` / `.dtmf-key` — bigger padding, used inside
 *               the in-call DTMF overlay so the keys are easy to tap
 */

interface Props {
  /** Called with the key string on normal click */
  onKey:          (key: string) => void
  /** Called on mousedown on the `0` key (start long-press timer) */
  onLongPress?:   () => void
  /** Called on mouseup/mouseleave on the `0` key (cancel timer) */
  onLongRelease?: () => void
  /** Compact variant for the in-call DTMF overlay (bigger taps) */
  compact?:       boolean
}

const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#']

const SUB: Record<string, string> = {
  '2':'ABC','3':'DEF','4':'GHI','5':'JKL',
  '6':'MNO','7':'PQRS','8':'TUV','9':'WXYZ','0':'+',
}

export default function DTMFKeypad({
  onKey,
  onLongPress,
  onLongRelease,
  compact = false,
}: Props) {
  const wrapClass = compact ? 'dtmf-grid' : 'kpad'
  const keyClass  = compact ? 'dtmf-key' : 'key'

  return (
    <div className={wrapClass}>
      {KEYS.map(k => {
        const isZero   = k === '0'
        const isSpecial = ['*','#'].includes(k)
        const cls = compact
          ? keyClass
          : `${keyClass}${isSpecial ? ' sp' : ''}`
        const style = compact && isSpecial ? { color: 'var(--violet)' } : undefined
        return (
          <button
            key={k}
            className={cls}
            style={style}
            onClick={() => onKey(k)}
            onMouseDown={isZero && onLongPress ? onLongPress : undefined}
            onMouseUp={isZero && onLongRelease ? onLongRelease : undefined}
            onMouseLeave={isZero && onLongRelease ? onLongRelease : undefined}
          >
            {k}
            {SUB[k] && <span className="ksub">{SUB[k]}</span>}
          </button>
        )
      })}
    </div>
  )
}
