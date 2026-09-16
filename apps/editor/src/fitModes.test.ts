import { describe, expect, it } from 'vitest'
import { describeFit, EDGES_H, EDGES_V, edgeLabel, fitBadge } from './fitModes'

describe('fitModes — edge choices', () => {
  it('offers the four plain choices per direction', () => {
    expect(EDGES_H.map((e) => e.id)).toEqual(['left', 'right', 'both', 'center'])
    expect(EDGES_V.map((e) => e.id)).toEqual(['top', 'bottom', 'both', 'center'])
    expect(edgeLabel('right', 'x')).toBe('Follows right')
    expect(edgeLabel('both', 'y')).toBe('Follows both (stretches)')
    expect(edgeLabel('center', 'x')).toBe('Centred')
  })

  it('badges non-default axes only', () => {
    expect(fitBadge('left', 'top')).toBe('')
    expect(fitBadge('right', 'top')).toBe('Follows right')
    expect(fitBadge('left', 'bottom')).toBe('Follows bottom')
    expect(fitBadge('both', 'center')).toBe('Follows both (stretches) · Centred')
  })

  it('describes each choice in plain English', () => {
    expect(describeFit('left', 'top')).toMatch(/left edge/)
    expect(describeFit('right', 'bottom')).toMatch(/right edge/)
    expect(describeFit('both', 'both')).toMatch(/grows and shrinks/)
    expect(describeFit('center', 'top')).toMatch(/centre/)
  })
})
