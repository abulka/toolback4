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
  box-sizing: border-box;
}

.tb-button {
  font: 500 15px/1 var(--tb-font);
  color: #ffffff;
  background: var(--tb-accent);
  border: none;
  border-radius: var(--tb-radius);
  padding: 0 20px;
  cursor: pointer;
  transition: filter 100ms ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

.tb-button:hover {
  background: var(--tb-accent-hover);
}

/* a whisper of a press: slightly darker, shadow eases away — nothing moves */
.tb-button:active {
  filter: brightness(0.92);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

/* coloured buttons keep a themed hover/press (background overridden inline) */
.tb-button.tb-colored:hover {
  filter: brightness(1.06);
}

.tb-button.tb-colored:active {
  filter: brightness(0.85);
}

.tb-label {
  font: 500 15px/1.45 var(--tb-font);
  color: var(--tb-text);
  display: flex;
  align-items: flex-start;
  padding: 3px 4px;
  overflow: hidden;
  overflow-wrap: break-word;
  white-space: pre-wrap;
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

/* markdown / HTML viewers: read-only rich content, scrollable inside the object */
.tb-markdown,
.tb-html {
  font: 400 15px/1.55 var(--tb-font);
  color: var(--tb-text);
  overflow: auto;
  overflow-wrap: break-word;
  scrollbar-width: thin;
}

.tb-markdown > :first-child,
.tb-html > :first-child {
  margin-top: 0;
}

.tb-markdown > :last-child,
.tb-html > :last-child {
  margin-bottom: 0;
}

.tb-markdown h1,
.tb-markdown h2,
.tb-markdown h3,
.tb-markdown h4,
.tb-markdown h5,
.tb-markdown h6 {
  font-weight: 600;
  line-height: 1.25;
  margin: 0.6em 0 0.35em;
}

.tb-markdown h1 { font-size: 1.7em; }
.tb-markdown h2 { font-size: 1.4em; }
.tb-markdown h3 { font-size: 1.2em; }
.tb-markdown h4 { font-size: 1.05em; }

.tb-markdown p {
  margin: 0.5em 0;
}

.tb-markdown ul,
.tb-markdown ol {
  margin: 0.5em 0;
  padding-left: 1.4em;
}

.tb-markdown li {
  margin: 0.15em 0;
}

.tb-markdown a {
  color: var(--tb-accent);
}

.tb-markdown code {
  font: 0.9em ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace;
  background: rgba(17, 24, 39, 0.07);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}

.tb-markdown pre {
  background: #111827;
  color: #f9fafb;
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0.6em 0;
}

.tb-markdown pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.tb-markdown blockquote {
  margin: 0.6em 0;
  padding: 0.2em 0.9em;
  border-left: 3px solid #d1d5db;
  color: var(--tb-text-muted);
}

.tb-markdown table {
  border-collapse: collapse;
  margin: 0.6em 0;
}

.tb-markdown th,
.tb-markdown td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
}

.tb-markdown img {
  max-width: 100%;
  height: auto;
}

.tb-viewer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: #9ca3af;
  font-size: 13px;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
}

.tb-viewer-empty-icon {
  font-weight: 600;
}

/* switch: pill toggle + label; the input is visually hidden but keeps focus */
.tb-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  --tb-switch-on: var(--tb-accent);
}

.tb-switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.tb-switch-track {
  position: relative;
  width: 44px;
  height: 24px;
  flex: 0 0 auto;
  background: #d1d5db;
  border-radius: 12px;
  transition: background 140ms ease;
}

.tb-switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: left 140ms ease;
}

.tb-switch input:checked + .tb-switch-track {
  background: var(--tb-switch-on);
}

.tb-switch input:checked + .tb-switch-track::after {
  left: 22px;
}

.tb-switch input:focus-visible + .tb-switch-track {
  outline: 2px solid var(--tb-switch-on);
  outline-offset: 2px;
}

.tb-switch-text {
  font: 500 15px/1.2 var(--tb-font);
  color: var(--tb-text);
}

/* groups: invisible wrapper around members; clicks pass to members only,
   but member events still bubble through the wrapper to group handlers.
   members re-enable pointer events (the property is inherited). */
.tb-group {
  pointer-events: none;
}

.tb-group .tb-object {
  pointer-events: auto;
}

/* ---- popups (run mode) ---- */

.tb-popup-layer {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
}

.tb-popup-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 17, 21, 0.45);
  pointer-events: auto;
}

.tb-popup {
  position: absolute;
  pointer-events: auto;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.45),
    0 4px 16px rgba(0, 0, 0, 0.3);
}

.tb-popup-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 32px;
  padding: 0 6px 0 12px;
  background: #1f2430;
  color: #cbd5e1;
  font: 600 12px/1 system-ui, sans-serif;
  user-select: none;
  cursor: move;
  touch-action: none;
}

.tb-popup-close {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
}

.tb-popup-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.tb-popup-content {
  position: relative;
}

/* ---- author mode (M6c): a plugin page floating over the editable book ---- */

.tb-author-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}

/* the plugin box is live UI: undo the design-mode input suppression
   (.tb-design .tb-page * would otherwise deaden its .tb-page content) */
.tb-design .tb-author-layer .tb-page,
.tb-design .tb-author-layer .tb-page * {
  pointer-events: auto !important;
}

.tb-author.tb-popup {
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.5),
    0 0 0 2px var(--tb-accent);
}

.tb-author .tb-popup-chrome {
  background: #2a2140;
  color: #c7d2fe;
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

/* background objects on a page are locked in design view — ghost them */
.tb-design .tb-page [data-tb-bg] {
  opacity: 0.4;
}

/* background design view: badge in the corner naming the background */
.tb-bg-badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 6;
  font: 600 11px/1 system-ui, sans-serif;
  letter-spacing: 0.4px;
  color: #64748b;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(100, 116, 139, 0.35);
  border-radius: 999px;
  padding: 4px 10px;
  pointer-events: none;
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

/* object sticking out of the page at the current breakpoint — the visible
   part gets a dashed red outline so clipping is seen, not guessed */
.tb-clip {
  position: absolute;
  outline: 2px dashed #dc2626;
  background: rgba(220, 38, 38, 0.08);
  pointer-events: none;
  display: none;
  z-index: 21;
}

/* responsive glue ("spring") hints: shape + muted colour per constraint kind.
   edge = solid zigzag, square anchor; center = plain dashed line, circle
   anchor; stretch = dashed circular coil, triangle anchor. Sits as the page's
   first child so it paints above the page background but UNDER the controls. */
.tb-fithint {
  position: absolute;
  pointer-events: none;
}

.tb-fithint-line,
.tb-fithint-spring,
.tb-fithint-anchor,
.tb-fithint-arrow {
  position: absolute;
}

.tb-fithint-line {
  background: rgba(100, 116, 139, 0.85);
  border-radius: 1px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.tb-fithint-line--stretch {
  background: rgba(217, 119, 6, 0.72);
}

.tb-fithint-spring--edge {
  color: rgba(100, 116, 139, 0.85);
}

.tb-fithint-spring--center {
  color: rgba(148, 163, 184, 0.95);
}

.tb-fithint-spring--center .tb-fithint-halo,
.tb-fithint-spring--center .tb-fithint-spring-path,
.tb-fithint-spring--stretch .tb-fithint-halo,
.tb-fithint-spring--stretch .tb-fithint-spring-path {
  stroke-dasharray: 5 4;
}

.tb-fithint-spring--stretch {
  color: rgba(217, 119, 6, 0.72);
}

.tb-fithint-anchor {
  width: 6px;
  height: 6px;
  background: rgba(100, 116, 139, 0.9);
  border-radius: 2px;
}

.tb-fithint-anchor--center {
  background: rgba(148, 163, 184, 0.95);
  border-radius: 50%;
}

.tb-fithint-anchor--stretch {
  width: 7px;
  height: 7px;
  background: rgba(217, 119, 6, 0.85);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

.tb-fithint-anchor--stretch.tb-fithint-anchor--down {
  transform: rotate(180deg);
}

.tb-fithint-anchor--stretch.tb-fithint-anchor--left {
  transform: rotate(-90deg);
}

.tb-fithint-anchor--stretch.tb-fithint-anchor--right {
  transform: rotate(90deg);
}

.tb-fithint-arrow {
  width: 8px;
  height: 8px;
  background: rgba(100, 116, 139, 0.9);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.7));
}

.tb-fithint-arrow--right {
  transform: rotate(90deg);
}

.tb-fithint-arrow--left {
  transform: rotate(-90deg);
}

.tb-fithint-arrow--down {
  transform: rotate(180deg);
}

.tb-marquee {
  position: absolute;
  border: 1px dashed var(--tb-accent);
  background: rgba(99, 102, 241, 0.08);
  pointer-events: none;
  display: none;
  z-index: 24;
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
