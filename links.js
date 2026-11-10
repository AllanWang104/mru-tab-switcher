// Cross-site link clicks open in a peek window. Inside floating windows, show a
// small bar to open the page as a normal tab (or close it). In fullscreen the
// background asks the page to show the link in an in-page frame instead.
(() => {
  if (window.top !== window || globalThis.__tabSwitcherLinks) return;
  globalThis.__tabSwitcherLinks = true;

  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});
  let kind = null; // null in normal windows, 'mini' or 'peek' in floating ones
  let peekEnabled = false;
  let frame = null; // { host, url } while an in-page frame is open

  chrome.runtime.sendMessage({ type: 'window-kind' }).then((r) => {
    kind = r?.kind ?? null;
    peekEnabled = !!r?.peek;
    if (kind) mountBar();
  }).catch(() => {});

  // Rough registrable domain: example.com, example.co.uk, example.com.tw.
  const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go']);
  function site(hostname) {
    const parts = hostname.replace(/^www\./, '').split('.');
    const n = parts.length >= 3 && parts.at(-1).length === 2 && SECOND_LEVEL.has(parts.at(-2)) ? 3 : 2;
    return parts.slice(-n).join('.');
  }

  addEventListener('click', (e) => {
    if (!peekEnabled || kind || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.composedPath().find((el) => el instanceof HTMLAnchorElement && el.href);
    if (!a || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (!/^https?:$/.test(url.protocol) || site(url.hostname) === site(location.hostname)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    send({ type: 'peek', url: url.href, origin: { x: e.clientX, y: e.clientY } });
  }, true);

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'open-frame') {
      openFrame(msg.kind, msg.url, msg.origin);
      reply(true);
    }
  });

  function mountBar() {
    const host = document.createElement('tab-switcher-bar');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = TabSwitcherUI.barCss;

    const bar = document.createElement('div');
    bar.className = 'bar';
    const open = document.createElement('button');
    open.textContent = 'Open as tab';
    open.title = 'Move this page to the main window';
    open.addEventListener('click', () => send({ type: 'promote' }));
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '✕';
    close.title = 'Close';
    close.addEventListener('click', () => send({ type: 'close-floating' }));
    bar.append(open, close);

    root.append(style, bar);
    document.documentElement.append(host);
  }

  // ---- In-page frame ----

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ICONS = {
    close: 'M3.5 3.5l7 7M10.5 3.5l-7 7',
    expand: 'M8.5 2.5h3v3M11.5 2.5L8 6M5.5 11.5h-3v-3M2.5 11.5L6 8',
  };

  function iconButton(icon, title, onClick) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 14 14');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', ICONS[icon]);
    svg.append(path);
    const button = document.createElement('button');
    button.title = title;
    button.setAttribute('aria-label', title);
    button.append(svg);
    button.addEventListener('click', onClick);
    return button;
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  // Animations start from whatever is on screen right now, so closing mid-open doesn't jump.
  function freeze(node) {
    const { transform, opacity } = getComputedStyle(node);
    node.getAnimations().forEach((a) => a.cancel());
    return { transform, opacity };
  }

  function openFrame(frameKind, url, origin) {
    detachFrame()?.host.remove();
    const host = document.createElement('tab-switcher-frame');
    const root = host.attachShadow({ mode: 'closed' });
    const style = el('style');
    style.textContent = TabSwitcherUI.frameCss;

    const scrim = el('div', 'scrim');
    scrim.addEventListener('click', () => closeFrame());
    const stage = el('div', 'stage');
    const panel = el('div', `panel ${frameKind}`);
    const sheet = el('div', 'sheet');
    const iframe = el('iframe');
    // No allow-top-navigation, so frame-busting scripts can't take over the page.
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups ' +
      'allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation';
    iframe.allow = 'clipboard-write; fullscreen';
    iframe.src = url;
    const controls = el('div', 'controls');
    controls.append(
      iconButton('close', 'Close', () => closeFrame()),
      iconButton('expand', 'Open as tab', () => expandFrame()),
    );

    sheet.append(iframe);
    panel.append(sheet, controls);
    stage.append(panel);
    root.append(style, scrim, stage);
    document.documentElement.append(host);

    // Grow out of the clicked link; links from other apps rise in place.
    const r = panel.getBoundingClientRect();
    panel.style.transformOrigin = origin ? `${origin.x - r.left}px ${origin.y - r.top}px` : '50% 50%';
    const collapsed = `scale(${origin ? 0.2 : 0.94})`;
    frame = { host, url, scrim, panel, sheet, controls, collapsed };

    const fadeIn = [{ opacity: 0 }, { opacity: 1 }];
    scrim.animate(fadeIn, { duration: 220, easing: 'ease-out' });
    if (reducedMotion.matches) {
      panel.animate(fadeIn, { duration: 160, easing: 'ease-out' });
    } else {
      panel.animate([{ transform: collapsed }, { transform: 'none' }], TabSwitcherUI.spring(0.42));
      panel.animate(fadeIn, { duration: 140, easing: 'ease-out' });
    }
    iframe.focus();
  }

  function detachFrame() {
    const f = frame;
    frame = null;
    return f;
  }

  // Leave the way it came in: back into the link it grew out of.
  function closeFrame() {
    const f = detachFrame();
    if (!f) return;
    send({ type: 'frame-closed' });
    f.scrim.style.pointerEvents = f.panel.style.pointerEvents = 'none';

    const from = freeze(f.panel);
    const out = [
      f.scrim.animate([{ opacity: getComputedStyle(f.scrim).opacity }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }),
      f.panel.animate([{ opacity: from.opacity }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
    ];
    if (!reducedMotion.matches) {
      f.panel.animate([{ transform: from.transform }, { transform: f.collapsed }], { ...TabSwitcherUI.spring(0.32), fill: 'forwards' });
    }
    Promise.all(out.map((a) => a.finished)).finally(() => f.host.remove());
  }

  // Grow toward the edges of the window, then hand the page over to a real tab.
  async function expandFrame() {
    const f = detachFrame();
    if (!f) return;
    f.scrim.style.pointerEvents = f.panel.style.pointerEvents = 'none';

    if (!reducedMotion.matches) {
      const from = freeze(f.panel);
      const r = f.panel.getBoundingClientRect();
      const scale = Math.max(innerWidth / r.width, innerHeight / r.height);
      f.panel.style.transformOrigin = '50% 50%';
      f.controls.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' });
      f.sheet.animate([{ borderRadius: '14px' }, { borderRadius: '0' }], { duration: 200, fill: 'forwards' });
      const grow = f.panel.animate(
        [{ transform: from.transform, opacity: from.opacity }, { transform: `scale(${scale})`, opacity: 1 }],
        { ...TabSwitcherUI.spring(0.3), fill: 'forwards' },
      );
      // Switch once it visibly fills the window; the spring's tail isn't worth waiting for.
      await new Promise((done) => setTimeout(done, grow.effect.getTiming().duration * 0.55));
    }
    send({ type: 'promote-frame', url: f.url });
    setTimeout(() => f.host.remove(), 300);
  }
})();
