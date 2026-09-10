export const stylesCss = /* css */ `
:root {
  --tb-accent: #4f46e5;
  --tb-accent-hover: #4338ca;
  --tb-danger: #dc2626;
  --tb-radius: 10px;
  --tb-font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --tb-text: #111827;
  --tb-text-muted: #6b7280;
}

html,
body {
  margin: 0;
  padding: 0;
}

.tb-page {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.tb-object {
  position: absolute;
  box-sizing: border-box;
}

.tb-object > * {
  width: 100%;
  height: 100%;
}

.tb-button {
  font: 500 15px/1 var(--tb-font);
  color: #ffffff;
  background: var(--tb-accent);
  border: none;
  border-radius: var(--tb-radius);
  padding: 0 20px;
  cursor: pointer;
  transition: background 120ms ease;
}

.tb-button:hover {
  background: var(--tb-accent-hover);
}

.tb-label {
  font: 500 22px/1.3 var(--tb-font);
  color: var(--tb-text);
  display: flex;
  align-items: center;
  overflow: hidden;
}

.tb-missing {
  font: 500 13px/1.4 var(--tb-font);
  color: var(--tb-danger);
  background: #fef2f2;
  border: 1px dashed var(--tb-danger);
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.tb-input {
  font: 400 15px/1 var(--tb-font);
  color: var(--tb-text);
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0 12px;
}

.tb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 8px;
}

.tb-image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 8px;
}

.tb-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.tb-card-title {
  font: 600 17px/1.3 var(--tb-font);
  color: var(--tb-text);
}

.tb-card-body {
  font: 400 14px/1.5 var(--tb-font);
  color: var(--tb-text-muted);
}

.tb-container {
  background: #f9fafb;
  border: 1.5px dashed #d1d5db;
  border-radius: 12px;
}

/* ---- design-mode chrome ---- */

.tb-canvas-root {
  position: relative;
}

.tb-page-holder {
  position: relative;
}

.tb-ghost {
  opacity: 0.75;
  outline: 2px dashed var(--tb-accent);
  outline-offset: 2px;
  z-index: 5;
}

.tb-ghost > * {
  pointer-events: none;
}

.tb-design .tb-page,
.tb-design .tb-page * {
  pointer-events: none !important;
}

.tb-design-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  touch-action: none;
  user-select: none;
}

.tb-sel {
  position: absolute;
  outline: 2px solid var(--tb-accent);
  pointer-events: none;
  display: none;
  z-index: 21;
}

.tb-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  background: #ffffff;
  border: 2px solid var(--tb-accent);
  border-radius: 3px;
  z-index: 22;
  display: none;
}

.tb-handle[data-dir='n'],
.tb-handle[data-dir='s'] {
  cursor: ns-resize;
}

.tb-handle[data-dir='e'],
.tb-handle[data-dir='w'] {
  cursor: ew-resize;
}

.tb-handle[data-dir='nw'],
.tb-handle[data-dir='se'] {
  cursor: nwse-resize;
}

.tb-handle[data-dir='ne'],
.tb-handle[data-dir='sw'] {
  cursor: nesw-resize;
}

.tb-sizebadge {
  position: absolute;
  font: 500 11px/1 var(--tb-font);
  color: #ffffff;
  background: var(--tb-accent);
  padding: 4px 7px;
  border-radius: 5px;
  pointer-events: none;
  display: none;
  z-index: 23;
  white-space: nowrap;
}
`
