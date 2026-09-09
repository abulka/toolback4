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
`
