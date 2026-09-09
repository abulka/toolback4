import { createObject, newId, type Book } from './index'

export function sampleBook(): Book {
  return {
    id: newId('book'),
    title: 'Hello Toolbook',
    canvas: { desktop: { width: 1280, height: 800 } },
    pages: [
      {
        id: newId('page'),
        name: 'Page 1',
        script: '',
        background: '#ffffff',
        objects: [
          createObject(
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
