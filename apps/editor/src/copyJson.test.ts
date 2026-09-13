import { describe, expect, it } from 'vitest'
import { createGroup, createObject } from '@toolback/format'
import { CLIPBOARD_KEY, clipboardToJson, objectsToJson, parseClipboardJson } from './copyJson'

describe('objectsToJson', () => {
  it('serializes a single object with its sub-object subtree', () => {
    const kid = createObject('button', 'kid', { desktop: { x: 0, y: 0, w: 40, h: 20 } })
    const group = createGroup('grp', { desktop: { x: 10, y: 10, w: 100, h: 50 } }, [kid])
    const json = objectsToJson([group])
    const parsed = JSON.parse(json)
    expect(parsed.name).toBe('grp')
    expect(parsed.children[0]!.name).toBe('kid')
    expect(json.split('\n').length).toBeGreaterThan(1) // pretty-printed
  })

  it('serializes multi-selections as an array', () => {
    const a = createObject('label', 'a', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
    const b = createObject('label', 'b', { desktop: { x: 20, y: 0, w: 10, h: 10 } })
    const parsed = JSON.parse(objectsToJson([a, b]))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.map((o: { name: string }) => o.name)).toEqual(['a', 'b'])
  })
})

describe('clipboard envelope', () => {
  it('wraps copies in a payload carrying the special key', () => {
    const a = createObject('label', 'a', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
    const json = clipboardToJson([a])
    const parsed = JSON.parse(json)
    expect(parsed[CLIPBOARD_KEY]).toBe(1)
    expect(parsed.objects.name).toBe('a')
  })

  it('wraps multi-selections as an objects array', () => {
    const a = createObject('label', 'a', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
    const b = createObject('label', 'b', { desktop: { x: 20, y: 0, w: 10, h: 10 } })
    const parsed = JSON.parse(clipboardToJson([a, b]))
    expect(Array.isArray(parsed.objects)).toBe(true)
    expect(parsed.objects.map((o: { name: string }) => o.name)).toEqual(['a', 'b'])
  })

  it('round-trips a group with its whole subtree', () => {
    const kid = createObject('button', 'kid', { desktop: { x: 0, y: 0, w: 40, h: 20 } })
    const group = createGroup('grp', { desktop: { x: 10, y: 10, w: 100, h: 50 } }, [kid])
    const parsed = parseClipboardJson(clipboardToJson([group]))!
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.name).toBe('grp')
    expect(parsed[0]!.children![0]!.name).toBe('kid')
  })

  it('parse returns null for plain JSON without the marker', () => {
    const a = createObject('label', 'a', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
    expect(parseClipboardJson(objectsToJson([a]))).toBeNull()
  })

  it('parse returns null for junk, arrays, and empty payloads', () => {
    expect(parseClipboardJson('not json')).toBeNull()
    expect(parseClipboardJson('[]')).toBeNull()
    expect(parseClipboardJson('42')).toBeNull()
    expect(parseClipboardJson(JSON.stringify({ [CLIPBOARD_KEY]: 1, objects: [] }))).toBeNull()
    expect(parseClipboardJson(JSON.stringify({ [CLIPBOARD_KEY]: 2, objects: {} }))).toBeNull()
    expect(parseClipboardJson(JSON.stringify({ [CLIPBOARD_KEY]: 1, objects: [{ nope: true }] }))).toBeNull()
  })
})