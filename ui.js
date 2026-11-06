// Shared rendering for the in-page overlay and the popup fallback.
// A horizontal strip of tab screenshots, most recent first.
globalThis.TabSwitcherUI = {
  css: `
    :host, .wrap { all: initial; }
    .wrap {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      font: 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
    }
    .wrap.embedded { position: static; height: 100vh; }
    .strip {
      pointer-events: auto; display: flex; gap: 12px; padding: 16px;
      max-width: calc(100vw - 48px); box-sizing: border-box;
      background: rgba(28, 28, 30, 0.72);
      backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8);
      border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 22px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .strip.pop { animation: pop 140ms cubic-bezier(0.2, 0.9, 0.3, 1.2); }
    @media (prefers-reduced-motion: reduce) { .strip.pop { animation: none; } }
    @keyframes pop { from { opacity: 0; transform: scale(0.96); } }
    .card {
      width: 200px; flex: 0 1 200px; min-width: 0;
      display: flex; flex-direction: column; gap: 8px;
      padding: 6px; border-radius: 14px; cursor: default;
      transition: background 90ms ease;
    }
    .card.sel { background: rgba(255, 255, 255, 0.14); }
    .shot {
      position: relative; aspect-ratio: 16 / 10; border-radius: 9px; overflow: hidden;
      background: rgba(255, 255, 255, 0.06);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
      display: flex; align-items: center; justify-content: center;
    }
    .card.sel .shot { box-shadow: 0 0 0 2.5px #8ab4f8, 0 8px 24px rgba(0, 0, 0, 0.35); }
    .shot img.thumb { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
    .shot img.big { width: 40px; height: 40px; opacity: 0.85; }
    .label { display: flex; align-items: center; gap: 6px; padding: 0 2px; color: rgba(255, 255, 255, 0.92); }
    .label img { width: 14px; height: 14px; flex: none; }
    .label span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card:not(.sel) .label { color: rgba(255, 255, 255, 0.6); }
  `,

  toastCss: `
    .toast {
      all: initial; position: fixed; z-index: 2147483647; top: 20px; left: 50%;
      transform: translateX(-50%); padding: 9px 16px; border-radius: 999px;
      font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #fff; background: rgba(28, 28, 30, 0.82);
      backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
      border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      animation: in 160ms ease-out, out 200ms ease-in 1400ms forwards;
    }
    @keyframes in { from { opacity: 0; transform: translate(-50%, -6px); } }
    @keyframes out { to { opacity: 0; } }
  `,

  faviconUrl(pageUrl, size = 32) {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', pageUrl || '');
    u.searchParams.set('size', String(size));
    return u.toString();
  },

  render(root, { tabs, index }, { embedded = false, animate = false, onPick } = {}) {
    root.replaceChildren();
    const style = document.createElement('style');
    style.textContent = this.css;
    const wrap = document.createElement('div');
    wrap.className = 'wrap' + (embedded ? ' embedded' : '');
    const strip = document.createElement('div');
    strip.className = 'strip' + (animate ? ' pop' : '');

    tabs.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'card' + (i === index ? ' sel' : '');

      const shot = document.createElement('div');
      shot.className = 'shot';
      const img = document.createElement('img');
      if (t.thumb) {
        img.className = 'thumb';
        img.src = t.thumb;
      } else {
        img.className = 'big';
        img.src = this.faviconUrl(t.url, 64);
      }
      shot.append(img);

      const label = document.createElement('div');
      label.className = 'label';
      const icon = document.createElement('img');
      icon.src = this.faviconUrl(t.url);
      const title = document.createElement('span');
      title.textContent = t.title || t.url || 'Untitled';
      label.append(icon, title);

      card.append(shot, label);
      card.addEventListener('mousedown', (e) => { e.preventDefault(); onPick?.(i); });
      strip.append(card);
    });

    wrap.append(strip);
    root.append(style, wrap);
  },
};
