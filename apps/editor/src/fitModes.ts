import type { XEdgeMode, YEdgeMode } from '@toolback/format'

export type FitAxis = 'x' | 'y'

/** the four edge choices the Responsive dropdowns offer per direction */
export interface EdgeOption {
  id: XEdgeMode | YEdgeMode
  label: string
}

export const EDGES_H: EdgeOption[] = [
  { id: 'left', label: 'Follows left' },
  { id: 'right', label: 'Follows right' },
  { id: 'both', label: 'Follows both (stretches)' },
  { id: 'center', label: 'Centred' },
]

export const EDGES_V: EdgeOption[] = [
  { id: 'top', label: 'Follows top' },
  { id: 'bottom', label: 'Follows bottom' },
  { id: 'both', label: 'Follows both (stretches)' },
  { id: 'center', label: 'Centred' },
]

export function edgesFor(axis: FitAxis): EdgeOption[] {
  return axis === 'x' ? EDGES_H : EDGES_V
}

/** plain-English explanation of one axis choice */
export function describeAxis(mode: string, axis: FitAxis): string {
  switch (mode) {
    case 'left':
      return 'Follows left — keeps its distance from the left edge and its own width.'
    case 'right':
      return 'Follows right — keeps its distance from the right edge and its own width.'
    case 'top':
      return 'Follows top — keeps its distance from the top edge and its own height.'
    case 'bottom':
      return 'Follows bottom — keeps its distance from the bottom edge and its own height.'
    case 'both':
      return axis === 'x'
        ? 'Follows both — keeps both side margins, so it grows and shrinks with the page width.'
        : 'Follows both — keeps both top/bottom margins, so it grows and shrinks with the page height.'
    case 'center':
      return axis === 'x'
        ? "Centred — keeps its size and stays on the page's horizontal centre."
        : "Centred — keeps its size and stays on the page's vertical centre."
    default:
      return ''
  }
}

/** short label for one axis choice */
export function edgeLabel(mode: string, axis: FitAxis): string {
  return edgesFor(axis).find((e) => e.id === mode)?.label ?? mode
}

/** combined hint for the current pair of edge choices */
export function describeFit(x: string, y: string): string {
  return [describeAxis(x, 'x'), describeAxis(y, 'y')].filter(Boolean).join(' · ')
}

/** combined header badge across both axes ('' for the default left + top) */
export function fitBadge(x: string, y: string): string {
  if (x === 'left' && y === 'top') return ''
  return [
    x === 'left' ? '' : edgeLabel(x, 'x'),
    y === 'top' ? '' : edgeLabel(y, 'y'),
  ]
    .filter(Boolean)
    .join(' · ')
}
