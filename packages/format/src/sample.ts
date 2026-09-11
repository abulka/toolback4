import { createBackground, createObject, newId, type Book } from './index'

export function sampleBook(): Book {
  const bg = createBackground('Background 1')
  return {
    id: newId('book'),
    title: 'Hello Toolbook',
    canvas: {
      desktop: { width: 1280, height: 800 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 390, height: 844 },
    },
    backgrounds: [bg],
    pages: [
      {
        id: newId('page'),
        name: 'Page 1',
        script: '',
        backgroundId: bg.id,
        objects: [          createObject(
            'label',
            'helloLabel',
            { desktop: { x: 96, y: 96, w: 480, h: 56 } },
            { text: 'Hello, Toolbook nostalgia!' },
          ),
          createObject(
            'button',
            'myButton',
            { desktop: { x: 96, y: 184, w: 176, h: 48 } },
            { text: 'Click me' },
          ),
        ],
      },
    ],
  }
}
