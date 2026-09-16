import type { FitHMode, FitVMode } from '@toolback/format'

export type FitAxis = 'x' | 'y'

/**
 * The user-facing Responsive model is two questions per axis:
 *   1. which edge(s) does the object glue to? (anchor)
 *   2. do the margins stay a fixed px, or scale with the page? (fixed)
 *
 * Internally the lens still stores the original mode tokens; this module is the
 * one place that maps between them so the panel never shows `pin-right`/`fill`.
 */
export type FitAnchor = 'free' | 'start' | 'center' | 'end' | 'both'

export interface AnchorOption {
  id: FitAnchor
  label: string
}

export const ANCHORS_H: AnchorOption[] = [
  { id: 'free', label: 'Free' },
  { id: 'start', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'end', label: 'Right' },
  { id: 'both', label: 'Both sides' },
]

export const ANCHORS_V: AnchorOption[] = [
  { id: 'free', label: 'Free' },
  { id: 'start', label: 'Top' },
  { id: 'center', label: 'Center' },
  { id: 'end', label: 'Bottom' },
  { id: 'both', label: 'Both sides' },
]

export function anchorsFor(axis: FitAxis): AnchorOption[] {
  return axis === 'x' ? ANCHORS_H : ANCHORS_V
}

/** the anchor a stored mode token represents (unknown/legacy → free) */
export function anchorOf(mode: string | undefined, axis: FitAxis): FitAnchor {
  const m = mode ?? 'free'
  if (m === 'free') return 'free'
  if (m === 'center') return 'center'
  if (axis === 'x') {
    if (m === 'left') return 'start'
    if (m === 'right' || m === 'pin-right') return 'end'
  } else {
    if (m === 'top') return 'start'
    if (m === 'bottom' || m === 'pin-bottom') return 'end'
  }
  if (m === 'stretch' || m === 'fill') return 'both'
  return 'free'
}

/** does the stored token keep its margins a fixed px? */
export function isFixed(mode: string | undefined): boolean {
  return mode === 'pin-right' || mode === 'pin-bottom' || mode === 'fill'
}

/** only the far-edge and both-sides anchors have a fixed/scaled choice */
export function canFix(anchor: FitAnchor): boolean {
  return anchor === 'end' || anchor === 'both'
}

/** the mode token an anchor + fixed choice maps to */
export function modeFor(anchor: FitAnchor, fixed: boolean, axis: FitAxis): FitHMode | FitVMode {
  switch (anchor) {
    case 'free':
      return 'free'
    case 'center':
      return 'center'
    case 'start':
      return axis === 'x' ? 'left' : 'top'
    case 'end':
      if (axis === 'x') return fixed ? 'pin-right' : 'right'
      return fixed ? 'pin-bottom' : 'bottom'
    case 'both':
      return fixed ? 'fill' : 'stretch'
  }
}

/** short header badge for one axis, e.g. "Right · fixed" ('' when Free) */
export function badgeOf(mode: string | undefined, axis: FitAxis): string {
  const anchor = anchorOf(mode, axis)
  if (anchor === 'free') return ''
  const label = anchorsFor(axis).find((a) => a.id === anchor)?.label ?? anchor
  if (!canFix(anchor)) return label
  return `${label} · ${isFixed(mode) ? 'fixed' : 'scaled'}`
}

/** plain-English explanation of one axis, naming Stretch/Fill where relevant */
export function describeAxis(mode: string | undefined, axis: FitAxis): string {
  const m = mode ?? 'free'
  switch (m) {
    case 'free':
      return 'Free — the layout stays exactly where you put it.'
    case 'left':
      return 'Left — the left margin keeps its share of the page (it scales).'
    case 'right':
      return 'Right — the right margin keeps its share of the page (it scales).'
    case 'pin-right':
      return 'Pinned right — the right margin stays a fixed number of px, so it moves with the edge.'
    case 'top':
      return 'Top — the top margin keeps its share of the page (it scales).'
    case 'bottom':
      return 'Bottom — the bottom margin keeps its share of the page (it scales).'
    case 'pin-bottom':
      return 'Pinned bottom — the bottom margin stays a fixed number of px, so it moves with the edge.'
    case 'center':
      return axis === 'x'
        ? "Center — the object's middle stays on the page's horizontal center."
        : "Center — the object's middle stays on the page's vertical center."
    case 'stretch':
      return 'Stretch — both margins scale with the page, so the object zooms with it.'
    case 'fill':
      return axis === 'x'
        ? 'Fill — both margins stay fixed and the size absorbs the page\'s extra width.'
        : 'Fill — both margins stay fixed and the size absorbs the page\'s extra height.'
    default:
      return 'Free — the layout stays exactly where you put it.'
  }
}

/** combined hint for the current pair of tokens (Free/Free → the free blurb) */
export function describeFit(h: string | undefined, v: string | undefined): string {
  const hs = anchorOf(h, 'x') === 'free' ? '' : describeAxis(h, 'x')
  const vs = anchorOf(v, 'y') === 'free' ? '' : describeAxis(v, 'y')
  if (!hs && !vs) return 'Free — the layout stays exactly where you put it.'
  return [hs, vs].filter(Boolean).join(' · ')
}

/** combined header badge across both axes */
export function fitBadge(h: string | undefined, v: string | undefined): string {
  return [badgeOf(h, 'x'), badgeOf(v, 'y')].filter(Boolean).join(' · ')
}
