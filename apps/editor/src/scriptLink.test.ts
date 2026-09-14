import { describe, expect, it } from 'vitest'
import { internalize } from './scriptLink'

describe('scriptLink internalize', () => {
  it('strips the generated header, keeping only the script body', () => {
    const out =
      '// toolback-linked script — edit me in VS Code (or in toolback) and save.\n' +
      '// Changes sync both ways.\n' +
      'declare const store: TBStore\n' +
      '// ============= toolback script =============\n' +
      "function pageEnter() { store.set('x', 1) }"
    expect(internalize(out)).toBe("function pageEnter() { store.set('x', 1) }")
  })

  it('passes through text without the marker untouched', () => {
    expect(internalize('function click() {}')).toBe('function click() {}')
  })

  it('handles an empty script body', () => {
    const out = 'declare const store: TBStore\n// ============= toolback script =============\n'
    expect(internalize(out)).toBe('')
  })

  it('strips the HTML-comment header for markdown and html flavour files', () => {
    const md =
      '<!-- toolback-linked markdown — edit me in VS Code. -->\n' +
      '<!-- ============= toolback markdown ============= -->\n' +
      '# Heading\n\nBody'
    expect(internalize(md, 'markdown')).toBe('# Heading\n\nBody')

    const html =
      '<!-- ============= toolback HTML ============= -->\n' +
      '<p>Hello</p>'
    expect(internalize(html, 'html')).toBe('<p>Hello</p>')
  })

  it('does not cross-strip markers between flavours', () => {
    const md = '<!-- ============= toolback markdown ============= -->\n# Hi'
    // a script read should not recognise the markdown marker
    expect(internalize(md, 'script')).toBe(md)
  })
})