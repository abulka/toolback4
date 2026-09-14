import { describe, expect, it } from 'vitest'
import { parseDesignValue } from './storeValue'

describe('parseDesignValue', () => {
  it('parses JSON numbers, booleans, null and quoted strings', () => {
    expect(parseDesignValue('100')).toBe(100)
    expect(parseDesignValue('1.5')).toBe(1.5)
    expect(parseDesignValue('-3')).toBe(-3)
    expect(parseDesignValue('true')).toBe(true)
    expect(parseDesignValue('false')).toBe(false)
    expect(parseDesignValue('null')).toBe(null)
    expect(parseDesignValue('"quoted"')).toBe('quoted')
  })

  it('parses JSON arrays and objects', () => {
    expect(parseDesignValue('[1, 2, 3]')).toEqual([1, 2, 3])
    expect(parseDesignValue('{"a": 1}')).toEqual({ a: 1 })
  })

  it('keeps everything else as a plain string', () => {
    expect(parseDesignValue('Fred')).toBe('Fred')
    expect(parseDesignValue('hello world')).toBe('hello world')
    expect(parseDesignValue('007')).toBe('007')
    expect(parseDesignValue('{a: 1}')).toBe('{a: 1}')
    expect(parseDesignValue('undefined')).toBe('undefined')
  })

  it('keeps empty and whitespace-only input as-is', () => {
    expect(parseDesignValue('')).toBe('')
    expect(parseDesignValue('   ')).toBe('   ')
  })
})
