import { describe, expect, it } from 'vitest'
import {
  anchorOf,
  badgeOf,
  canFix,
  describeFit,
  fitBadge,
  isFixed,
  modeFor,
  type FitAnchor,
} from './fitModes'

describe('fitModes — token ⇄ anchor mapping', () => {
  const H: Array<[string, FitAnchor, boolean]> = [
    ['free', 'free', false],
    ['left', 'start', false],
    ['center', 'center', false],
    ['right', 'end', false],
    ['pin-right', 'end', true],
    ['stretch', 'both', false],
    ['fill', 'both', true],
  ]
  const V: Array<[string, FitAnchor, boolean]> = [
    ['free', 'free', false],
    ['top', 'start', false],
    ['center', 'center', false],
    ['bottom', 'end', false],
    ['pin-bottom', 'end', true],
    ['stretch', 'both', false],
    ['fill', 'both', true],
  ]

  it('reads the anchor out of every horizontal token', () => {
    for (const [mode, anchor] of H) expect(anchorOf(mode, 'x')).toBe(anchor)
  })
  it('reads the anchor out of every vertical token', () => {
    for (const [mode, anchor] of V) expect(anchorOf(mode, 'y')).toBe(anchor)
  })
  it('builds every horizontal token back', () => {
    for (const [mode, anchor, fixed] of H) expect(modeFor(anchor, fixed, 'x')).toBe(mode)
  })
  it('builds every vertical token back', () => {
    for (const [mode, anchor, fixed] of V) expect(modeFor(anchor, fixed, 'y')).toBe(mode)
  })

  it('isFixed is true only for pin/fill', () => {
    for (const [mode, , fixed] of H) expect(isFixed(mode)).toBe(fixed)
    for (const [mode, , fixed] of V) expect(isFixed(mode)).toBe(fixed)
  })

  it('canFix is true only for the end/both anchors', () => {
    expect(canFix('free')).toBe(false)
    expect(canFix('start')).toBe(false)
    expect(canFix('center')).toBe(false)
    expect(canFix('end')).toBe(true)
    expect(canFix('both')).toBe(true)
  })

  it('legacy/unknown tokens fall back to free', () => {
    expect(anchorOf(undefined, 'x')).toBe('free')
    expect(anchorOf('bogus', 'y')).toBe('free')
  })
})

describe('fitModes — labels', () => {
  it('badges name the anchor and the margin behavior', () => {
    expect(badgeOf('free', 'x')).toBe('')
    expect(badgeOf('left', 'x')).toBe('Left')
    expect(badgeOf('right', 'x')).toBe('Right · scaled')
    expect(badgeOf('pin-right', 'x')).toBe('Right · fixed')
    expect(badgeOf('stretch', 'x')).toBe('Both sides · scaled')
    expect(badgeOf('fill', 'x')).toBe('Both sides · fixed')
    expect(badgeOf('center', 'y')).toBe('Center')
    expect(badgeOf('pin-bottom', 'y')).toBe('Bottom · fixed')
  })

  it('fitBadge combines both axes', () => {
    expect(fitBadge('pin-right', 'top')).toBe('Right · fixed · Top')
    expect(fitBadge('free', 'free')).toBe('')
  })

  it('the hint names Stretch and Fill where relevant', () => {
    expect(describeFit('stretch', 'free')).toMatch(/Stretch/)
    expect(describeFit('fill', 'free')).toMatch(/Fill/)
    expect(describeFit('pin-right', 'free')).toMatch(/fixed/)
    expect(describeFit('free', 'free')).toMatch(/exactly where you put it/)
  })
})
