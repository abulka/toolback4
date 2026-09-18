import { describe, expect, it } from 'vitest'
import {
  BOX_KINDS,
  BORDER_STYLES,
  CAPABILITY_VERSION,
  CONTROL_KINDS,
  CONTROL_PROPS,
  DEFAULT_PROPS,
  FONT_FAMILIES,
  SCRIPT_API,
  TEXT_ALIGNS,
  VERTICAL_ALIGNS,
} from './index'

const BOX_PROP_NAMES = ['borderWidth', 'borderStyle', 'borderColor', 'radius', 'opacity']

describe('capability manifest', () => {
  it('covers every control kind', () => {
    for (const kind of CONTROL_KINDS) {
      expect(CONTROL_PROPS[kind], kind).toBeDefined()
    }
  })

  it('declares every default prop', () => {
    for (const kind of CONTROL_KINDS) {
      const declared = new Set((CONTROL_PROPS[kind] ?? []).map((p) => p.name))
      for (const key of Object.keys(DEFAULT_PROPS[kind] ?? {})) {
        expect(declared.has(key), `${kind}.${key}`).toBe(true)
      }
    }
  })

  it('has unique prop names per control and a doc for each', () => {
    for (const kind of CONTROL_KINDS) {
      const names = (CONTROL_PROPS[kind] ?? []).map((p) => p.name)
      expect(new Set(names).size).toBe(names.length)
      for (const prop of CONTROL_PROPS[kind] ?? []) {
        expect(prop.doc.length, `${kind}.${prop.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('uses the published enums for styled props', () => {
    const props = CONTROL_KINDS.flatMap((k) => CONTROL_PROPS[k] ?? [])
    const fontFamily = props.find((p) => p.name === 'fontFamily')
    const textAlign = props.find((p) => p.name === 'textAlign')
    const vAlign = props.find((p) => p.name === 'vAlign')
    const borderStyle = props.find((p) => p.name === 'borderStyle')
    expect(fontFamily?.enum).toEqual(FONT_FAMILIES)
    expect(textAlign?.enum).toEqual(TEXT_ALIGNS)
    expect(vAlign?.enum).toEqual(VERTICAL_ALIGNS)
    expect(borderStyle?.enum).toEqual(BORDER_STYLES)
  })

  it('declares the box props (border/radius/opacity) exactly on BOX_KINDS', () => {
    for (const kind of CONTROL_KINDS) {
      const names = new Set((CONTROL_PROPS[kind] ?? []).map((p) => p.name))
      const isBox = (BOX_KINDS as readonly string[]).includes(kind)
      for (const prop of BOX_PROP_NAMES) {
        expect(names.has(prop), `${kind}.${prop}`).toBe(isBox)
      }
    }
  })

  it('declares trackColor only on the switch', () => {
    for (const kind of CONTROL_KINDS) {
      const names = (CONTROL_PROPS[kind] ?? []).map((p) => p.name)
      expect(names.includes('trackColor'), kind).toBe(kind === 'switch')
    }
  })

  it('describes the runtime script API', () => {
    expect(SCRIPT_API.length).toBeGreaterThan(0)
    expect(SCRIPT_API.map((n) => n.name)).toContain('store')
    expect(SCRIPT_API.map((n) => n.name)).toContain('page')
    expect(CAPABILITY_VERSION).toBeGreaterThan(0)
  })
})
