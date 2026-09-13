import { describe, expect, it } from 'vitest'
import { createGroup, createObject } from '@toolback/format'
import { objectsToJson } from './copyJson'

describe('objectsToJson', () => {
  it('serializes a single object with its sub-object subtree', () => {
    const kid = createObject('button', 'kid', { x: 0, y: 0, w: 40, h: 20 })
    const group = createGroup('grp', { x: 10, y: 10, w: 100, h: 50 }, [kid])
    const json = objectsToJson([group])
    const parsed = JSON.parse(json)
    expect(parsed.name).toBe('grp')
    expect(parsed.children[0]!.name).toBe('kid')
    expect(json.split('\n').length).toBeGreaterThan(1) // pretty-printed
  })

  it('serializes multi-selections as an array', () => {
    const a = createObject('label', 'a', { x: 0, y: 0, w: 10, h: 10 })
    const b = createObject('label', 'b', { x: 20, y: 0, w: 10, h: 10 })
    const parsed = JSON.parse(objectsToJson([a, b]))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.map((o: { name: string }) => o.name)).toEqual(['a', 'b'])
  })
})
