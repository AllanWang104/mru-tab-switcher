// Popup fallback for pages where content scripts can't run (chrome://, new tab, PDF…).
// The popup is focused while Ctrl is still held, so it receives the Control keyup itself.
const root = document.getElementById('root').attachShadow({ mode: 'open' });
let current = null;
let done = false;

const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});

function finish(type, index) {
  if (done) return;
  done = true;
  send({ type, index });
}

function draw() {
  if (current) TabSwitcherUI.render(root, current, { embedded: true, onPick: (i) => finish('commit', i) });
}

chrome.runtime.sendMessage({ type: 'get-state' }).then((s) => {
  if (!s) return window.close();
  current ??= { tabs: s.tabs, index: s.index };
  draw();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'show') return;
  current = { tabs: msg.tabs, index: msg.index };
  draw();
});

addEventListener('keyup', (e) => {
  if (e.key === 'Control') finish('commit', current?.index);
}, true);

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') finish('cancel');
  else if (e.key === 'Enter') finish('commit', current?.index);
}, true);

addEventListener('blur', () => finish('commit', current?.index));
