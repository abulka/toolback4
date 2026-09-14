import { resolveStartPageIndex } from '@toolback/format'
import { runBook } from './index'

/**
 * Entry point for the standalone published player. The published HTML
 * embeds the book JSON on window.__TOOLBACK_BOOK__ before this bundle,
 * which then plays the book starting at its start page (first page when
 * unset).
 */
const book = (window as unknown as { __TOOLBACK_BOOK__?: import('@toolback/format').Book })
  .__TOOLBACK_BOOK__

if (book) {
  runBook(book, document.body as HTMLElement, 'desktop', undefined, resolveStartPageIndex(book))
}
