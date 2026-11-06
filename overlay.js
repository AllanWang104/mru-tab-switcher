// In-page overlay. Commits when the physical Control key is released.
(() => {
  if (window.top !== window || globalThis.__tabSwitcherOverlay) return;
  globalThis.__tabSwitcherOverlay = true;

  const RELEASE_DEBOUNCE_MS = 80; // tolerate a synthetic Ctrl-up from the key remapper
  const SHOW_DELAY_MS = 120;      // quick taps switch without flashing the overlay

  let ctrlDown = false;
  let active = false;
  let current = null;
  let host = null;
  let shadow = null;
  let showTimer = null;
  let commitTimer = null;

  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});

  function teardown() {
    active = false;
    clearTimeout(showTimer);
    clearTimeout(commitTimer);
    showTimer = commitTimer = null;
    host?.remove();
    host = shadow = null;
  }

  function commit(index = current?.index) {
    if (!active) return;
    teardown();
    send({ type: 'commit', index });
  }

  function cancel() {
    if (!active) return;
    teardown();
    send({ type: 'cancel' });
  }

  function draw() {
    showTimer = null;
    if (!active || !current) return;
    const first = !host;
    if (first) {
      host = document.createElement('tab-switcher-overlay');
      shadow = host.attachShadow({ mode: 'closed' });
      document.documentElement.append(host);
    }
    TabSwitcherUI.render(shadow, current, { animate: first, onPick: commit });
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
      ctrlDown = true;
      clearTimeout(commitTimer);
      return;
    }
    if (!active) return;
    if (e.key === 'Escape') cancel();
    else if (e.key === 'Enter') commit();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  addEventListener('keyup', (e) => {
    if (e.key !== 'Control') return;
    ctrlDown = false;
    if (!active) return;
    clearTimeout(commitTimer);
    commitTimer = setTimeout(() => commit(), RELEASE_DEBOUNCE_MS);
  }, true);

  addEventListener('blur', () => {
    ctrlDown = false;
    if (active) commit();
  });

  // Ask for a fresh thumbnail once the page settles after the user scrolls or clicks.
  let refreshTimer = null;
  const refreshThumb = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!active && document.visibilityState === 'visible') send({ type: 'refresh-thumb' });
    }, 1500);
  };
  addEventListener('scroll', refreshThumb, { capture: true, passive: true });
  addEventListener('click', refreshThumb, true);

  let toastHost = null;
  let toastTimer = null;
  function toast(text) {
    toastHost?.remove();
    clearTimeout(toastTimer);
    toastHost = document.createElement('tab-switcher-toast');
    const root = toastHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = TabSwitcherUI.toastCss;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    root.append(style, el);
    document.documentElement.append(toastHost);
    toastTimer = setTimeout(() => { toastHost?.remove(); toastHost = null; }, 1600);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'toast') {
      reply(true);
      return toast(msg.text);
    }
    if (msg.type !== 'show') return;
    reply(true);
    clearTimeout(commitTimer);
    current = { tabs: msg.tabs, index: msg.index };

    if (msg.fresh || !active) {
      active = true;
      if (msg.assumeCtrl) ctrlDown = true;
      if (!ctrlDown) return commit(); // Ctrl already released: quick tap
      clearTimeout(showTimer);
      showTimer = setTimeout(draw, SHOW_DELAY_MS);
    } else if (!showTimer) {
      draw();
    }
  });
})();
