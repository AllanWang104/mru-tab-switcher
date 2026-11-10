const DEFAULTS = { mini: true, peek: true };

chrome.storage.local.get('settings').then(({ settings }) => {
  const current = { ...DEFAULTS, ...settings };
  for (const key of Object.keys(DEFAULTS)) {
    const box = document.getElementById(key);
    box.checked = current[key];
    box.addEventListener('change', () => {
      current[key] = box.checked;
      chrome.storage.local.set({ settings: current });
    });
  }
});
