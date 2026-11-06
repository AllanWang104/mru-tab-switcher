// MRU tab cycling. State lives in storage.session so it survives service-worker restarts.
const KEY = 'cycle';
const STALE_MS = 15000;
const MAX_TABS = 7;
const THUMB_WIDTH = 480;
const THUMB_PREFIX = 'thumb:';

const getState = async () => (await chrome.storage.session.get(KEY))[KEY] ?? null;
const setState = (s) => (s ? chrome.storage.session.set({ [KEY]: s }) : chrome.storage.session.remove(KEY));

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'copy-url') return copyUrl(tab);
  const step = command === 'cycle-prev' ? -1 : 1;
  let s = await getState();
  const fromPopup = s?.popupWindowId != null && tab?.windowId === s.popupWindowId;
  const stale = !s || Date.now() - s.ts > STALE_MS || (!fromPopup && tab?.id !== s.hostTabId);

  let fresh = false;
  if (stale) {
    const windowId = tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
    const tabs = await chrome.tabs.query({ windowId });
    if (tabs.length < 2) return;
    // lastAccessed gives MRU order; keep the active tab pinned at index 0.
    tabs.sort((a, b) => (b.active - a.active) || ((b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)));
    s = {
      windowId,
      hostTabId: tabs[0].id,
      popupWindowId: null,
      index: 0,
      tabs: tabs.slice(0, MAX_TABS).map(({ id, title, url }) => ({ id, title, url })),
    };
    fresh = true;
  }
  const n = s.tabs.length;
  s.index = (s.index + step + n) % n;
  s.ts = Date.now();
  await setState(s);
  await show(s, fresh);
});

async function show(s, fresh) {
  const msg = { type: 'show', tabs: await withThumbs(s.tabs), index: s.index, fresh };

  if (s.popupWindowId != null) {
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }
  if (await sendToTab(s.hostTabId, msg)) return;

  // Tab was open before the extension loaded: inject, then assume Ctrl is still held.
  try {
    await chrome.scripting.executeScript({ target: { tabId: s.hostTabId }, files: ['ui.js', 'overlay.js'] });
    if (await sendToTab(s.hostTabId, { ...msg, assumeCtrl: true })) return;
  } catch {
    // chrome://, new tab, web store, PDF viewer… fall through to the popup window.
  }
  await openPopup(s);
}

async function sendToTab(tabId, msg) {
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) === true;
  } catch {
    return false;
  }
}

async function openPopup(s) {
  const win = await chrome.windows.get(s.windowId);
  const width = 32 + s.tabs.length * 212;
  const height = 250;
  const popup = await chrome.windows.create({
    url: 'switcher.html',
    type: 'popup',
    focused: true,
    width,
    height,
    left: Math.round(win.left + (win.width - width) / 2),
    top: Math.round(win.top + (win.height - height) / 3),
  });
  s.popupWindowId = popup.id;
  await setState(s);
}

async function finish(type, index) {
  const s = await getState();
  if (!s) return;
  await setState(null);
  if (s.popupWindowId != null) chrome.windows.remove(s.popupWindowId).catch(() => {});
  if (type !== 'commit') return;
  const target = s.tabs[index ?? s.index];
  if (target) await chrome.tabs.update(target.id, { active: true }).catch(() => {});
  if (s.popupWindowId != null) chrome.windows.update(s.windowId, { focused: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'commit' || msg.type === 'cancel') {
    finish(msg.type, msg.index).then(() => reply(true));
    return true;
  }
  if (msg.type === 'get-state') {
    getState().then(async (s) => reply(s && { ...s, tabs: await withThumbs(s.tabs) }));
    return true;
  }
  if (msg.type === 'refresh-thumb' && sender.tab) scheduleCapture(sender.tab.id, 0);
});

// --- Copy URL ---------------------------------------------------------------

async function copyUrl(tab) {
  tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.url) return;

  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Copy the current tab URL to the clipboard',
    });
  }
  const ok = await chrome.runtime.sendMessage({ type: 'offscreen-copy', text: tab.url });
  await sendToTab(tab.id, { type: 'toast', text: ok ? 'Copied link' : 'Copy failed' });
}

// --- Thumbnails -------------------------------------------------------------
// captureVisibleTab only sees the active tab, so snapshot each tab while it is
// on screen: on activation, on load complete, and after the user interacts.

async function withThumbs(tabs) {
  const thumbs = await chrome.storage.session.get(tabs.map((t) => THUMB_PREFIX + t.id));
  return tabs.map((t) => ({ ...t, thumb: thumbs[THUMB_PREFIX + t.id] ?? null }));
}

const captureTimers = new Map();
let lastCaptureAt = 0;

function scheduleCapture(tabId, delay) {
  clearTimeout(captureTimers.get(tabId));
  captureTimers.set(tabId, setTimeout(() => {
    captureTimers.delete(tabId);
    capture(tabId).catch(() => {});
  }, delay));
}

async function capture(tabId) {
  if (await getState()) return; // never snapshot the switcher overlay itself
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active || tab.url?.startsWith(chrome.runtime.getURL(''))) return;

  // Chromium allows ~2 captures per second.
  const wait = lastCaptureAt + 550 - Date.now();
  if (wait > 0) return scheduleCapture(tabId, wait);
  lastCaptureAt = Date.now();

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
  await chrome.storage.session.set({ [THUMB_PREFIX + tabId]: await shrink(dataUrl) });
}

async function shrink(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const height = Math.round((bitmap.height * THUMB_WIDTH) / bitmap.width);
  const canvas = new OffscreenCanvas(THUMB_WIDTH, height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, THUMB_WIDTH, height);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:image/jpeg;base64,' + btoa(binary);
}

chrome.tabs.onActivated.addListener(({ tabId }) => scheduleCapture(tabId, 400));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) scheduleCapture(tabId, 300);
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(THUMB_PREFIX + tabId));
