// Floating pages, loaded into the service worker by background.js.
//   mini — links opened from other apps open in a small frame over the current tab.
//   peek — clicking a link to another site opens it in a larger frame over the page.
// Both can be promoted to a normal tab. When the page can't host a frame (chrome://
// pages, the New Tab page) they fall back to a popup window — except in fullscreen,
// where the window sits in its own macOS Space and popups can't float over it.
const FLOATING_KEY = 'floating';
const FOCUS_KEY = 'focus';
const EXTERNAL_FOCUS_MS = 1500; // browser regained focus this recently → the link came from another app
const STARTUP_GRACE_MS = 10000; // ignore session-restore tabs
const DEFAULT_SETTINGS = { mini: true, peek: true };

const getFloating = async () => (await chrome.storage.session.get(FLOATING_KEY))[FLOATING_KEY] ?? {};
const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get('settings')).settings });

async function setFloating(windowId, info) {
  const all = await getFloating();
  if (info) all[windowId] = info;
  else delete all[windowId];
  await chrome.storage.session.set({ [FLOATING_KEY]: all });
}

async function openFloating(kind, { url, tab, parent }) {
  const width = kind === 'peek' ? Math.round(parent.width * 0.82) : Math.min(760, parent.width - 40);
  const height = kind === 'peek' ? Math.round(parent.height * 0.86) : Math.min(820, parent.height - 40);
  const bounds = {
    type: 'popup',
    focused: true,
    width,
    height,
    left: Math.round(parent.left + (parent.width - width) / 2),
    top: Math.round(parent.top + (parent.height - height) / 2),
  };

  let win = null;
  if (tab) win = await chrome.windows.create({ ...bounds, tabId: tab.id }).catch(() => null);
  if (!win) {
    // Some builds refuse to move a tab into a popup window; reopen the URL instead.
    win = await chrome.windows.create({ ...bounds, url });
    if (tab) chrome.tabs.remove(tab.id).catch(() => {});
  }
  await setFloating(win.id, { kind, parentWindowId: parent.id });
}

// Lift frame-blocking headers for subframes of this one tab while its frame is open.
const allowFraming = (tabId) => chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [tabId],
  addRules: [{
    id: tabId,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'x-frame-options', operation: 'remove' },
        { header: 'content-security-policy', operation: 'remove' },
      ],
    },
    condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] },
  }],
});
const disallowFraming = (tabId) => chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });

async function openFrame(kind, hostTab, url, origin) {
  await allowFraming(hostTab.id);
  const ok = await chrome.tabs.sendMessage(hostTab.id, { type: 'open-frame', kind, url, origin }).catch(() => false);
  if (!ok) await disallowFraming(hostTab.id);
  return !!ok;
}

async function promote(tab) {
  const info = tab && (await getFloating())[tab.windowId];
  if (!info) return;

  const target =
    (await chrome.windows.get(info.parentWindowId).catch(() => null)) ??
    (await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null));

  if (target) {
    try {
      await chrome.tabs.move(tab.id, { windowId: target.id, index: -1 });
      await chrome.tabs.update(tab.id, { active: true });
    } catch {
      // Tabs can't always leave a popup window; reopen the page in the main window.
      await chrome.tabs.create({ windowId: target.id, url: tab.url, active: true });
    }
    await chrome.windows.update(target.id, { focused: true });
  } else {
    await chrome.windows.create({ url: tab.url, type: 'normal', focused: true });
  }

  await setFloating(tab.windowId, null);
  chrome.windows.remove(tab.windowId).catch(() => {});
}

chrome.runtime.onStartup.addListener(() => chrome.storage.session.set({ startedAt: Date.now() }));

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const prev = (await chrome.storage.session.get(FOCUS_KEY))[FOCUS_KEY];
  await chrome.storage.session.set({ [FOCUS_KEY]: { windowId, from: prev?.windowId, at: Date.now() } });
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  // Peek closes once you click back into another browser window.
  for (const [id, info] of Object.entries(await getFloating())) {
    if (info.kind === 'peek' && Number(id) !== windowId) chrome.windows.remove(Number(id)).catch(() => {});
  }
});

chrome.windows.onRemoved.addListener((windowId) => setFloating(windowId, null));
chrome.tabs.onRemoved.addListener((tabId) => disallowFraming(tabId).catch(() => {}));

chrome.tabs.onCreated.addListener(async (tab) => {
  const url = tab.pendingUrl || tab.url;
  if (tab.openerTabId != null || !/^https?:/.test(url ?? '')) return;

  const { [FOCUS_KEY]: focus, startedAt = 0 } = await chrome.storage.session.get([FOCUS_KEY, 'startedAt']);
  if (Date.now() - startedAt < STARTUP_GRACE_MS) return;
  const NONE = chrome.windows.WINDOW_ID_NONE;
  const fromOtherApp =
    !focus || focus.windowId === NONE || (focus.from === NONE && Date.now() - focus.at < EXTERNAL_FOCUS_MS);
  if (!fromOtherApp || !(await getSettings()).mini) return;

  const parent = await chrome.windows.get(tab.windowId);
  if (parent.type !== 'normal') return;

  // Show it over the tab you were on.
  const [host] = (await chrome.tabs.query({ windowId: parent.id }))
    .filter((t) => t.id !== tab.id)
    .sort((a, b) => b.lastAccessed - a.lastAccessed);
  if (host && (await openFrame('mini', host, url))) {
    await chrome.tabs.update(host.id, { active: true });
    chrome.tabs.remove(tab.id).catch(() => {});
  } else if (parent.state !== 'fullscreen') {
    await openFloating('mini', { url, tab, parent });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tab = sender.tab;
  if (!tab) return;

  if (msg.type === 'window-kind') {
    Promise.all([getFloating(), getSettings()]).then(([floating, settings]) =>
      reply({ kind: floating[tab.windowId]?.kind ?? null, peek: settings.peek }));
    return true;
  }
  if (msg.type === 'peek') {
    chrome.windows.get(tab.windowId).then(async (parent) => {
      if (await openFrame('peek', tab, msg.url, msg.origin)) return;
      if (parent.state !== 'fullscreen') return openFloating('peek', { url: msg.url, parent });
      chrome.tabs.create({ windowId: parent.id, index: tab.index + 1, url: msg.url });
    });
  } else if (msg.type === 'promote') {
    promote(tab);
  } else if (msg.type === 'promote-frame') {
    chrome.tabs.create({ windowId: tab.windowId, index: tab.index + 1, url: msg.url, active: true });
    disallowFraming(tab.id);
  } else if (msg.type === 'frame-closed') {
    disallowFraming(tab.id);
  } else if (msg.type === 'close-floating') {
    chrome.windows.remove(tab.windowId).catch(() => {});
  }
});
