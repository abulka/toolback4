import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { sampleBook } from '@toolback/format/src/sample'
import type { ObjectRects } from '@toolback/runtime'

export const useBookStore = defineStore('book', () => {
  const book = ref(sampleBook())
  const canvasReady = ref(false)
  const rects = ref<ObjectRects>({})
  const error = ref('')

  const activePage = computed(() => book.value.pages[0]!)
  const objectCount = computed(() => Object.keys(rects.value).length)

  return { book, canvasReady, rects, error, activePage, objectCount }
})
